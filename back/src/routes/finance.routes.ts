import { Router } from 'express';
import type {
  Expense,
  FeeStructure,
  Invoice,
  Payment,
  PaymentMethod,
  Student,
} from '../types';
import { getDb, saveDb } from '../db/store';
import { currentUser, requireAuth, requirePermission } from '../middleware/auth';
import { asyncHandler, assert } from '../middleware/http';
import { logActivity } from '../services/activity';
import { invoicePaidAmount } from '../utils/calculations';
import { normalize, todayIso, uid } from '../utils/format';

type InvoiceResultStatus = 'payee' | 'partielle' | 'impayee' | 'retard';

interface InvoiceRow {
  invoice: Invoice;
  student: Student | null;
  studentName: string;
  className: string;
  levelId: string | null;
  paid: number;
  balance: number;
  status: InvoiceResultStatus;
}

interface PaymentRow extends Payment {
  studentName: string;
  matricule: string;
  className: string;
  invoiceLabel: string;
}

function invoiceStatus(invoice: Invoice, paid: number): InvoiceResultStatus {
  if (paid >= invoice.amount) return 'payee';
  if (paid > 0) return 'partielle';
  if (invoice.dueDate < todayIso()) return 'retard';
  return 'impayee';
}

function buildInvoiceRows(
  filters: {
    search?: string;
    classId?: string;
    levelId?: string;
    status?: string;
  } = {},
): InvoiceRow[] {
  const db = getDb();
  return db.invoices
    .map((invoice) => {
      const student = db.students.find((item) => item.id === invoice.studentId) ?? null;
      const schoolClass = db.classes.find((item) => item.id === student?.classId);
      const paid = invoicePaidAmount(invoice.id, db.payments);
      return {
        invoice,
        student,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Élève supprimé',
        className: schoolClass?.name ?? '—',
        levelId: schoolClass?.levelId ?? null,
        paid,
        balance: Math.max(0, invoice.amount - paid),
        status: invoiceStatus(invoice, paid),
      };
    })
    .filter((row) => {
      if (filters.classId && row.student?.classId !== filters.classId) return false;
      if (filters.levelId && row.levelId !== filters.levelId) return false;
      if (filters.status && row.status !== filters.status) return false;
      if (filters.search) {
        const haystack = normalize(
          `${row.studentName} ${row.student?.matricule ?? ''} ${row.invoice.label}`,
        );
        if (!haystack.includes(normalize(filters.search))) return false;
      }
      return true;
    })
    .sort((a, b) => b.invoice.dueDate.localeCompare(a.invoice.dueDate));
}

// ---------------------------------------------------------------------------
// Frais scolaires
// ---------------------------------------------------------------------------

export const feesRouter = Router();
feesRouter.use(requireAuth);

feesRouter.get(
  '/',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const levelId = typeof req.query.levelId === 'string' ? req.query.levelId : undefined;
    res.json(getDb().feeStructures.filter((fee) => !levelId || fee.levelId === levelId));
  }),
);

feesRouter.post(
  '/',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<FeeStructure>;
    assert(typeof input.label === 'string' && input.label.trim(), 400, 'Le libellé est obligatoire.');
    assert(typeof input.levelId === 'string' && input.levelId, 400, 'Le niveau est obligatoire.');
    assert(
      typeof input.academicYearId === 'string' && input.academicYearId,
      400,
      'L’année scolaire est obligatoire.',
    );
    assert(Number.isFinite(Number(input.amount)), 400, 'Le montant est invalide.');
    assert(typeof input.dueDate === 'string' && input.dueDate, 400, 'L’échéance est obligatoire.');

    const db = getDb();
    const fee: FeeStructure = {
      id: uid('fee'),
      levelId: input.levelId,
      academicYearId: input.academicYearId,
      label: input.label,
      amount: Number(input.amount),
      dueDate: input.dueDate,
    };
    db.feeStructures.push(fee);
    await saveDb(db);
    res.status(201).json(fee);
  }),
);

feesRouter.put(
  '/:id',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.feeStructures.some((fee) => fee.id === id), 404, 'Frais introuvables.');
    db.feeStructures = db.feeStructures.map((fee) =>
      fee.id === id ? { ...fee, ...(req.body as Partial<FeeStructure>), id } : fee,
    );
    await saveDb(db);
    res.json(db.feeStructures.find((fee) => fee.id === id));
  }),
);

feesRouter.delete(
  '/:id',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const exists = db.feeStructures.some((fee) => fee.id === req.params.id);
    assert(exists, 404, 'Frais introuvables.');
    db.feeStructures = db.feeStructures.filter((fee) => fee.id !== req.params.id);
    await saveDb(db);
    res.status(204).end();
  }),
);

feesRouter.post(
  '/generate-invoices',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const { academicYearId } = (req.body ?? {}) as { academicYearId?: string };
    assert(
      typeof academicYearId === 'string' && academicYearId,
      400,
      'L’année scolaire est obligatoire.',
    );
    const db = getDb();
    const year = db.academicYears.find((item) => item.id === academicYearId);
    let created = 0;

    db.students
      .filter((student) => student.status === 'actif' && student.classId)
      .forEach((student) => {
        const schoolClass = db.classes.find((item) => item.id === student.classId);
        if (!schoolClass) return;
        db.feeStructures
          .filter((fee) => fee.levelId === schoolClass.levelId && fee.academicYearId === academicYearId)
          .forEach((fee) => {
            const exists = db.invoices.some(
              (invoice) =>
                invoice.studentId === student.id &&
                invoice.academicYearId === academicYearId &&
                invoice.label === fee.label,
            );
            if (exists) return;
            db.invoices.push({
              id: uid('inv'),
              studentId: student.id,
              academicYearId,
              label: fee.label,
              amount: fee.amount,
              dueDate: fee.dueDate,
              createdAt: todayIso(),
            });
            created += 1;
          });
      });

    logActivity(db, {
      type: 'payment',
      title: 'Facturation générée',
      description: `${created} facture(s) créée(s) pour ${year?.name ?? 'l’année active'}`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.json(created);
  }),
);

// ---------------------------------------------------------------------------
// Factures
// ---------------------------------------------------------------------------

export const invoicesRouter = Router();
invoicesRouter.use(requireAuth);

invoicesRouter.get(
  '/',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    res.json(
      buildInvoiceRows({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
        levelId: typeof req.query.levelId === 'string' ? req.query.levelId : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
      }),
    );
  }),
);

invoicesRouter.get(
  '/open',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : undefined;
    res.json(
      buildInvoiceRows().filter(
        (row) => row.balance > 0 && (!studentId || row.student?.id === studentId),
      ),
    );
  }),
);

invoicesRouter.delete(
  '/:id',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    assert(db.invoices.some((invoice) => invoice.id === req.params.id), 404, 'Facture introuvable.');
    assert(
      !db.payments.some((payment) => payment.invoiceId === req.params.id),
      400,
      'Impossible de supprimer une facture déjà payée.',
    );
    db.invoices = db.invoices.filter((invoice) => invoice.id !== req.params.id);
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

export const paymentsRouter = Router();
paymentsRouter.use(requireAuth);

function paymentRows(filters: {
  search?: string;
  classId?: string;
  method?: string;
  from?: string;
  to?: string;
}): PaymentRow[] {
  const db = getDb();
  return db.payments
    .filter((payment) => {
      if (filters.method && payment.method !== filters.method) return false;
      if (filters.from && payment.date < filters.from) return false;
      if (filters.to && payment.date > filters.to) return false;
      if (filters.classId) {
        const student = db.students.find((item) => item.id === payment.studentId);
        if (student?.classId !== filters.classId) return false;
      }
      return true;
    })
    .map((payment) => {
      const student = db.students.find((item) => item.id === payment.studentId);
      const schoolClass = db.classes.find((item) => item.id === student?.classId);
      const invoice = db.invoices.find((item) => item.id === payment.invoiceId);
      return {
        ...payment,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Élève supprimé',
        matricule: student?.matricule ?? '—',
        className: schoolClass?.name ?? '—',
        invoiceLabel: invoice?.label ?? '—',
      };
    })
    .filter((row) =>
      filters.search
        ? normalize(`${row.studentName} ${row.matricule} ${row.receiptNumber}`).includes(
            normalize(filters.search),
          )
        : true,
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

paymentsRouter.get(
  '/',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    res.json(
      paymentRows({
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
        method: typeof req.query.method === 'string' ? req.query.method : undefined,
        from: typeof req.query.from === 'string' ? req.query.from : undefined,
        to: typeof req.query.to === 'string' ? req.query.to : undefined,
      }),
    );
  }),
);

paymentsRouter.get(
  '/:id',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const row = paymentRows({}).find((payment) => payment.id === req.params.id);
    assert(row, 404, 'Paiement introuvable.');
    res.json(row);
  }),
);

paymentsRouter.post(
  '/',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as {
      studentId?: string;
      invoiceId?: string;
      amount?: number;
      method?: PaymentMethod;
      date?: string;
      note?: string;
    };
    assert(typeof input.studentId === 'string' && input.studentId, 400, 'L’élève est obligatoire.');
    assert(typeof input.invoiceId === 'string' && input.invoiceId, 400, 'La facture est obligatoire.');
    const amount = Number(input.amount);
    assert(Number.isFinite(amount) && amount > 0, 400, 'Le montant doit être supérieur à zéro.');

    const db = getDb();
    const student = db.students.find((item) => item.id === input.studentId);
    assert(student, 404, 'Élève introuvable.');
    const invoice = db.invoices.find((item) => item.id === input.invoiceId);
    assert(invoice, 404, 'Facture introuvable.');
    assert(
      invoice.studentId === student.id,
      400,
      'La facture sélectionnée n’appartient pas à cet élève.',
    );
    const alreadyPaid = invoicePaidAmount(invoice.id, db.payments);
    const balance = invoice.amount - alreadyPaid;
    assert(
      amount <= balance,
      400,
      `Le montant dépasse le solde restant (${balance.toLocaleString('fr-FR')} FCFA).`,
    );

    const year = new Date().getFullYear();
    const highest = db.payments.reduce((max, payment) => {
      const match = payment.receiptNumber.match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);

    const payment: Payment = {
      id: uid('pay'),
      studentId: input.studentId,
      invoiceId: input.invoiceId,
      amount,
      date: input.date || todayIso(),
      method: input.method ?? 'espece',
      receiptNumber: `REC-${year}-${String(highest + 1).padStart(4, '0')}`,
      recordedBy: currentUser(res).name,
      note: input.note ?? '',
    };
    db.payments.push(payment);

    logActivity(db, {
      type: 'payment',
      title: 'Paiement enregistré',
      description: `${payment.amount.toLocaleString('fr-FR')} FCFA encaissés${
        student ? ` pour ${student.firstName} ${student.lastName}` : ''
      }`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(201).json(payment);
  }),
);

paymentsRouter.delete(
  '/:id',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    assert(db.payments.some((payment) => payment.id === req.params.id), 404, 'Paiement introuvable.');
    db.payments = db.payments.filter((payment) => payment.id !== req.params.id);
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Dépenses
// ---------------------------------------------------------------------------

export const expensesRouter = Router();
expensesRouter.use(requireAuth);

expensesRouter.get(
  '/',
  requirePermission('finance.view'),
  asyncHandler(async (req, res) => {
    const filters = {
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
    };
    res.json(
      getDb()
        .expenses.filter((expense) => {
          if (filters.category && expense.category !== filters.category) return false;
          if (filters.from && expense.date < filters.from) return false;
          if (filters.to && expense.date > filters.to) return false;
          if (filters.search) {
            return normalize(`${expense.label} ${expense.category}`).includes(normalize(filters.search));
          }
          return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }),
);

expensesRouter.post(
  '/',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const input = (req.body ?? {}) as Partial<Expense>;
    assert(typeof input.label === 'string' && input.label.trim(), 400, 'Le libellé est obligatoire.');
    assert(Number.isFinite(Number(input.amount)) && Number(input.amount) > 0, 400, 'Le montant est invalide.');
    assert(typeof input.date === 'string' && input.date, 400, 'La date est obligatoire.');

    const db = getDb();
    const expense: Expense = {
      id: uid('exp'),
      label: input.label,
      category: input.category ?? 'Divers',
      amount: Number(input.amount),
      date: input.date,
      method: input.method ?? 'espece',
      recordedBy: currentUser(res).name,
      note: input.note ?? '',
    };
    db.expenses.unshift(expense);
    logActivity(db, {
      type: 'expense',
      title: 'Dépense enregistrée',
      description: `${expense.label} — ${expense.amount.toLocaleString('fr-FR')} FCFA`,
      actor: currentUser(res).name,
    });
    await saveDb(db);
    res.status(201).json(expense);
  }),
);

expensesRouter.put(
  '/:id',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const id = req.params.id;
    assert(db.expenses.some((expense) => expense.id === id), 404, 'Dépense introuvable.');
    const { id: _id, recordedBy: _recordedBy, ...updates } = (req.body ?? {}) as Partial<Expense>;
    void _id;
    void _recordedBy;
    db.expenses = db.expenses.map((expense) =>
      expense.id === id ? { ...expense, ...updates } : expense,
    );
    await saveDb(db);
    res.json(db.expenses.find((expense) => expense.id === id));
  }),
);

expensesRouter.delete(
  '/:id',
  requirePermission('finance.manage'),
  asyncHandler(async (req, res) => {
    const db = getDb();
    assert(db.expenses.some((expense) => expense.id === req.params.id), 404, 'Dépense introuvable.');
    db.expenses = db.expenses.filter((expense) => expense.id !== req.params.id);
    await saveDb(db);
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Synthèse de caisse
// ---------------------------------------------------------------------------

export const cashRouter = Router();
cashRouter.use(requireAuth);

cashRouter.get(
  '/cash-summary',
  requirePermission('finance.view'),
  asyncHandler(async (_req, res) => {
    const db = getDb();
    const today = todayIso();
    const byMethod: Record<PaymentMethod, number> = { espece: 0, mobile: 0, virement: 0, cheque: 0 };
    db.payments.forEach((payment) => {
      byMethod[payment.method] += payment.amount;
    });
    const totalIn = db.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalOut = db.expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const payments = paymentRows({});

    res.json({
      todayIn: db.payments
        .filter((payment) => payment.date === today)
        .reduce((sum, payment) => sum + payment.amount, 0),
      todayOut: db.expenses
        .filter((expense) => expense.date === today)
        .reduce((sum, expense) => sum + expense.amount, 0),
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
      byMethod,
      recentPayments: payments.slice(0, 6),
      recentExpenses: db.expenses.slice(0, 6),
    });
  }),
);
