import { useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import type { PaymentMethod, Student } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { studentsService } from '@/services/students.service';
import { invoicesService, paymentsService, type InvoiceRow } from '@/services/finance.service';
import { PAYMENT_METHOD_LABELS } from '@/config/labels';
import { formatCurrency, todayIso } from '@/utils/format';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  studentId?: string;
  invoiceId?: string;
}

export function PaymentModal({ open, onClose, onSaved, studentId, invoiceId }: PaymentModalProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('espece');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    studentsService.list({ status: 'actif' }).then((list) => {
      if (!active) return;
      const sorted = list.sort((a, b) => a.lastName.localeCompare(b.lastName));
      setStudents(sorted);
      setSelectedStudent(studentId ?? sorted[0]?.id ?? '');
    });
    setSelectedInvoice(invoiceId ?? '');
    setAmount('');
    setMethod('espece');
    setDate(todayIso());
    setNote('');
    return () => {
      active = false;
    };
  }, [open, studentId, invoiceId]);

  useEffect(() => {
    if (!open || !selectedStudent) {
      setInvoices([]);
      return;
    }
    let active = true;
    setLoadingInvoices(true);
    invoicesService
      .openInvoices(selectedStudent)
      .then((rows) => {
        if (!active) return;
        setInvoices(rows);
        setSelectedInvoice((current) => {
          if (current && rows.some((row) => row.invoice.id === current)) return current;
          return invoiceId && rows.some((row) => row.invoice.id === invoiceId) ? invoiceId : rows[0]?.invoice.id ?? '';
        });
      })
      .finally(() => {
        if (active) setLoadingInvoices(false);
      });
    return () => {
      active = false;
    };
  }, [open, selectedStudent, invoiceId]);

  const invoice = useMemo(
    () => invoices.find((row) => row.invoice.id === selectedInvoice) ?? null,
    [invoices, selectedInvoice],
  );

  useEffect(() => {
    if (invoice) setAmount(String(invoice.balance));
  }, [invoice]);

  const handleSubmit = async () => {
    if (!selectedStudent || !selectedInvoice) {
      toast.error('Sélectionnez un élève et une facture.');
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      toast.error('Saisissez un montant supérieur à zéro.');
      return;
    }
    setSaving(true);
    try {
      await paymentsService.record(
        {
          studentId: selectedStudent,
          invoiceId: selectedInvoice,
          amount: value,
          method,
          date,
          note: note.trim(),
        },
        user?.name ?? 'Comptabilité',
      );
      toast.success('Paiement encaissé et reçu généré.');
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Encaissement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Encaisser un paiement"
      description="Le reçu est numéroté automatiquement et rattaché à la facture."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<Wallet size={15} />} loading={saving} onClick={() => void handleSubmit()}>
            Encaisser
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Élève"
          required
          fieldClassName="sm:col-span-2"
          value={selectedStudent}
          onChange={(event) => {
            setSelectedStudent(event.target.value);
            setSelectedInvoice('');
          }}
        >
          <option value="">Sélectionner un élève</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.lastName} {student.firstName} — {student.matricule}
            </option>
          ))}
        </Select>

        <Select
          label="Facture à régler"
          required
          fieldClassName="sm:col-span-2"
          value={selectedInvoice}
          onChange={(event) => setSelectedInvoice(event.target.value)}
          disabled={loadingInvoices || invoices.length === 0}
          hint={
            invoices.length === 0 && selectedStudent
              ? 'Aucune facture impayée pour cet élève.'
              : invoice
                ? `Solde restant : ${formatCurrency(invoice.balance)}`
                : undefined
          }
        >
          {invoices.length === 0 ? <option value="">Aucune facture ouverte</option> : null}
          {invoices.map((row) => (
            <option key={row.invoice.id} value={row.invoice.id}>
              {row.invoice.label} — reste {formatCurrency(row.balance)}
            </option>
          ))}
        </Select>

        <Input
          label="Montant (FCFA)"
          type="number"
          min={1}
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          hint={invoice ? `Maximum ${formatCurrency(invoice.balance)}` : undefined}
        />
        <Select label="Mode de paiement" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)}>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Input
          label="Date du paiement"
          type="date"
          required
          fieldClassName="sm:col-span-2"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <Textarea
          label="Note"
          fieldClassName="sm:col-span-2"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Référence, précision sur le versement…"
        />
      </div>
    </Modal>
  );
}
