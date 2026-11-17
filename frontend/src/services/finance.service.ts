import type {
  Expense,
  FeeStructure,
  Invoice,
  Payment,
  PaymentMethod,
  Student,
} from '@/types';
import {
  ApiError,
  apiMutate,
  apiRequest,
  clone,
  delay,
  logActivity,
  queryString,
  remoteFirst,
} from '@/services/api';
import { getDb, saveDb } from '@/services/db';
import { invoicePaidAmount } from '@/utils/calculations';
import { normalize, todayIso, uid } from '@/utils/format';

export type FeeInput = Omit<FeeStructure, 'id'>;
export type ExpenseInput = Omit<Expense, 'id' | 'recordedBy'>;

export interface InvoiceRow {
  invoice: Invoice;
  student: Student | null;
  studentName: string;
  className: string;
  levelId: string | null;
  paid: number;
  balance: number;
  status: 'payee' | 'partielle' | 'impayee' | 'retard';
}

export interface PaymentRow extends Payment {
  studentName: string;
  matricule: string;
  className: string;
  invoiceLabel: string;
}

export interface PaymentInput {
  studentId: string;
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  note: string;
}

export interface InvoiceFilters {
  search?: string;
  classId?: string;
  levelId?: string;
  status?: '' | 'payee' | 'partielle' | 'impayee' | 'retard';
}

export interface PaymentFilters {
  search?: string;
  classId?: string;
  method?: PaymentMethod | '';
  from?: string;
  to?: string;
}

function invoiceStatus(invoice: Invoice, paid: number): InvoiceRow['status'] {
  if (paid >= invoice.amount) return 'payee';
  if (paid > 0) return 'partielle';
  if (invoice.dueDate < todayIso()) return 'retard';
  return 'impayee';
}

function buildInvoiceRows(filters: InvoiceFilters = {}): InvoiceRow[] {
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
        const haystack = normalize(`${row.studentName} ${row.student?.matricule ?? ''} ${row.invoice.label}`);
        if (!haystack.includes(normalize(filters.search))) return false;
      }
      return true;
    })
    .sort((a, b) => b.invoice.dueDate.localeCompare(a.invoice.dueDate));
}

const localFeesService = {
  async list(levelId?: string): Promise<FeeStructure[]> {
    await delay(80);
    return clone(getDb().feeStructures.filter((fee) => !levelId || fee.levelId === levelId));
  },

  async create(input: FeeInput): Promise<void> {
    await delay(160);
    const db = getDb();
    db.feeStructures.push({ ...input, id: uid('fee') });
    saveDb(db);
  },

  async update(id: string, input: Partial<FeeInput>): Promise<void> {
    await delay(140);
    const db = getDb();
    db.feeStructures = db.feeStructures.map((fee) => (fee.id === id ? { ...fee, ...input } : fee));
    saveDb(db);
  },

  async remove(id: string): Promise<void> {
    await delay(140);
    const db = getDb();
    db.feeStructures = db.feeStructures.filter((fee) => fee.id !== id);
    saveDb(db);
  },

  async generateInvoices(academicYearId: string): Promise<number> {
    await delay(320);
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
      actor: 'Comptabilité',
    });
    saveDb(db);
    return created;
  },
};

const localInvoicesService = {
  async list(filters: InvoiceFilters = {}): Promise<InvoiceRow[]> {
    await delay(120);
    return clone(buildInvoiceRows(filters));
  },

  async openInvoices(studentId?: string): Promise<InvoiceRow[]> {
    await delay(80);
    return clone(buildInvoiceRows().filter((row) => row.balance > 0 && (!studentId || row.student?.id === studentId)));
  },

  async remove(id: string): Promise<void> {
    await delay(160);
    const db = getDb();
    if (db.payments.some((payment) => payment.invoiceId === id)) {
      throw new Error('Impossible de supprimer une facture déjà payée.');
    }
    db.invoices = db.invoices.filter((invoice) => invoice.id !== id);
    saveDb(db);
  },
};

const localPaymentsService = {
  async list(filters: PaymentFilters = {}): Promise<PaymentRow[]> {
    await delay(120);
    const db = getDb();
    return clone(
      db.payments
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
          filters.search ? normalize(`${row.studentName} ${row.matricule} ${row.receiptNumber}`).includes(normalize(filters.search)) : true,
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  },

  async record(input: PaymentInput, actor: string): Promise<Payment> {
    await delay(260);
    const db = getDb();
    const invoice = db.invoices.find((item) => item.id === input.invoiceId);
    if (!invoice) throw new Error('Facture introuvable.');
    if (input.amount <= 0) throw new Error('Le montant doit être supérieur à zéro.');
    const alreadyPaid = invoicePaidAmount(invoice.id, db.payments);
    const balance = invoice.amount - alreadyPaid;
    if (input.amount > balance) {
      throw new Error(`Le montant dépasse le solde restant (${balance.toLocaleString('fr-FR')} FCFA).`);
    }
    const year = new Date().getFullYear();
    const highest = db.payments.reduce((max, payment) => {
      const match = payment.receiptNumber.match(/(\d+)$/);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    const payment: Payment = {
      id: uid('pay'),
      studentId: input.studentId,
      invoiceId: input.invoiceId,
      amount: input.amount,
      date: input.date || todayIso(),
      method: input.method,
      receiptNumber: `REC-${year}-${String(highest + 1).padStart(4, '0')}`,
      recordedBy: actor,
      note: input.note,
    };
    db.payments.push(payment);
    const student = db.students.find((item) => item.id === input.studentId);
    logActivity(db, {
      type: 'payment',
      title: 'Paiement enregistré',
      description: `${payment.amount.toLocaleString('fr-FR')} FCFA encaissés${student ? ` pour ${student.firstName} ${student.lastName}` : ''}`,
      actor,
    });
    saveDb(db);
    return clone(payment);
  },

  async remove(id: string): Promise<void> {
    await delay(160);
    const db = getDb();
    db.payments = db.payments.filter((payment) => payment.id !== id);
    saveDb(db);
  },

  async find(id: string): Promise<PaymentRow | null> {
    const rows = await localPaymentsService.list();
    return rows.find((row) => row.id === id) ?? null;
  },
};

const localExpensesService = {
  async list(filters: { search?: string; category?: string; from?: string; to?: string } = {}): Promise<Expense[]> {
    await delay(100);
    return clone(
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
  },

  async create(input: ExpenseInput, actor: string): Promise<void> {
    await delay(180);
    const db = getDb();
    const expense: Expense = { ...input, id: uid('exp'), recordedBy: actor };
    db.expenses.unshift(expense);
    logActivity(db, {
      type: 'expense',
      title: 'Dépense enregistrée',
      description: `${expense.label} — ${expense.amount.toLocaleString('fr-FR')} FCFA`,
      actor,
    });
    saveDb(db);
  },

  async update(id: string, input: Partial<ExpenseInput>): Promise<void> {
    await delay(160);
    const db = getDb();
    db.expenses = db.expenses.map((expense) => (expense.id === id ? { ...expense, ...input } : expense));
    saveDb(db);
  },

  async remove(id: string): Promise<void> {
    await delay(140);
    const db = getDb();
    db.expenses = db.expenses.filter((expense) => expense.id !== id);
    saveDb(db);
  },
};

export interface CashSummary {
  todayIn: number;
  todayOut: number;
  totalIn: number;
  totalOut: number;
  balance: number;
  byMethod: Record<PaymentMethod, number>;
  recentPayments: PaymentRow[];
  recentExpenses: Expense[];
}

async function localCashSummary(): Promise<CashSummary> {
  await delay(100);
  const db = getDb();
  const today = todayIso();
  const byMethod: Record<PaymentMethod, number> = { espece: 0, mobile: 0, virement: 0, cheque: 0 };
  db.payments.forEach((payment) => {
    byMethod[payment.method] += payment.amount;
  });
  const totalIn = db.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalOut = db.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const payments = await localPaymentsService.list();
  return clone({
    todayIn: db.payments.filter((payment) => payment.date === today).reduce((sum, payment) => sum + payment.amount, 0),
    todayOut: db.expenses.filter((expense) => expense.date === today).reduce((sum, expense) => sum + expense.amount, 0),
    totalIn,
    totalOut,
    balance: totalIn - totalOut,
    byMethod,
    recentPayments: payments.slice(0, 6),
    recentExpenses: db.expenses.slice(0, 6),
  });
}

// ---------------------------------------------------------------------------
// Implémentations distantes
// ---------------------------------------------------------------------------

const remoteFeesService: typeof localFeesService = {
  list: (levelId) => apiRequest<FeeStructure[]>(`/fees${queryString({ levelId })}`),

  create: async (input) => {
    await apiMutate<FeeStructure>('/fees', { method: 'POST', body: JSON.stringify(input) });
  },

  update: async (id, input) => {
    await apiMutate<FeeStructure>(`/fees/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  remove: async (id) => {
    await apiMutate<void>(`/fees/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  generateInvoices: (academicYearId) =>
    apiMutate<number>('/fees/generate-invoices', {
      method: 'POST',
      body: JSON.stringify({ academicYearId }),
    }),
};

const remoteInvoicesService: typeof localInvoicesService = {
  list: (filters = {}) =>
    apiRequest<InvoiceRow[]>(
      `/invoices${queryString({
        search: filters.search,
        classId: filters.classId,
        levelId: filters.levelId,
        status: filters.status,
      })}`,
    ),

  openInvoices: (studentId) =>
    apiRequest<InvoiceRow[]>(`/invoices/open${queryString({ studentId })}`),

  remove: async (id) => {
    await apiMutate<void>(`/invoices/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

const remotePaymentsService: typeof localPaymentsService = {
  list: (filters = {}) =>
    apiRequest<PaymentRow[]>(
      `/payments${queryString({
        search: filters.search,
        classId: filters.classId,
        method: filters.method,
        from: filters.from,
        to: filters.to,
      })}`,
    ),

  record: (input) =>
    apiMutate<Payment>('/payments', { method: 'POST', body: JSON.stringify(input) }),

  remove: async (id) => {
    await apiMutate<void>(`/payments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  find: async (id) => {
    try {
      return await apiRequest<PaymentRow>(`/payments/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
    }
  },
};

const remoteExpensesService: typeof localExpensesService = {
  list: (filters = {}) =>
    apiRequest<Expense[]>(
      `/expenses${queryString({
        search: filters.search,
        category: filters.category,
        from: filters.from,
        to: filters.to,
      })}`,
    ),

  create: async (input) => {
    await apiMutate<Expense>('/expenses', { method: 'POST', body: JSON.stringify(input) });
  },

  update: async (id, input) => {
    await apiMutate<Expense>(`/expenses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  remove: async (id) => {
    await apiMutate<void>(`/expenses/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

export const feesService = remoteFirst(remoteFeesService, localFeesService);
export const invoicesService = remoteFirst(remoteInvoicesService, localInvoicesService);
export const paymentsService = remoteFirst(remotePaymentsService, localPaymentsService);
export const expensesService = remoteFirst(remoteExpensesService, localExpensesService);

export async function cashSummary(): Promise<CashSummary> {
  try {
    return await apiRequest<CashSummary>('/finance/cash-summary');
  } catch (error) {
    if (error instanceof ApiError && error.unavailable) {
      console.warn('[EDUFLOW] API injoignable — synthèse de caisse locale utilisée.');
      return localCashSummary();
    }
    throw error;
  }
}
