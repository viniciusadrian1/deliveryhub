'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { moneyInput, parseMoneyCents } from '../../lib/money';
import { api } from '../../lib/api';
import type { Expense, ExpenseCategory, ExpenseRecurrence } from '../../lib/expense-types';
import { EXPENSE_CATEGORY_LABELS, EXPENSE_RECURRENCE_LABELS } from '../../lib/expense-types';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';
import { Input } from '../ui/input';

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  storeId: string;
  editing?: Expense | null;
}

export function ExpenseFormDialog({ open, onClose, storeId, editing }: ExpenseFormDialogProps) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('rent');
  const [employeeCount, setEmployeeCount] = useState('1');
  const [amountReais, setAmountReais] = useState('');
  const [recurrence, setRecurrence] = useState<ExpenseRecurrence>('one_time');
  const [dueDay, setDueDay] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setCategory(editing?.category ?? 'rent');
    setEmployeeCount(String(editing?.employeeCount ?? 1));
    setAmountReais(
      editing
        ? moneyInput(
            editing.amountCents /
              (editing.category === 'payroll' ? (editing.employeeCount ?? 1) : 1),
          )
        : '',
    );
    setRecurrence(editing?.recurrence ?? 'one_time');
    setDueDay(editing?.dueDay?.toString() ?? '');
    setOccurredAt(
      editing?.occurredAt ? new Date(editing.occurredAt).toISOString().slice(0, 10) : '',
    );
    setPaymentMethod(editing?.paymentMethod ?? '');
    setNotes(editing?.notes ?? '');
  }, [open, editing]);

  const unitCents = parseMoneyCents(amountReais);
  const count = category === 'payroll' ? Number(employeeCount) : 1;
  const validCount = Number.isInteger(count) && count >= 1 && count <= 10000;
  const totalCents = (unitCents ?? 0) * count;
  const mutation = useMutation({
    mutationFn: async () => {
      if (unitCents === null || !validCount || totalCents > 2147483647)
        throw new Error('Verifique o valor e a quantidade de funcionários.');
      const cents = totalCents;
      const body = {
        name,
        category,
        amountCents: cents,
        employeeCount: count,
        recurrence,
        dueDay: dueDay ? parseInt(dueDay, 10) : null,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        paymentMethod: paymentMethod || undefined,
        notes: notes || undefined,
      };
      if (editing) {
        return api(`/financial/expenses/${editing.id}`, { method: 'PATCH', body });
      }
      return api('/financial/expenses', {
        method: 'POST',
        body: { ...body, storeId },
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['expenses'] });
      void qc.invalidateQueries({ queryKey: ['fin'] });
      void qc.invalidateQueries({ queryKey: ['dre'] });
      onClose();
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar "${editing.name}"` : 'Nova despesa'}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!name.trim() || unitCents === null || !validCount || totalCents > 2147483647}
          >
            {editing ? 'Salvar' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {mutation.error && (
          <p role="alert" className="text-sm text-danger-bright">
            {mutation.error.message}
          </p>
        )}
        <Input
          label="Nome"
          placeholder="Ex.: Aluguel do salão"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm outline-none focus:border-brand-500"
            >
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={category === 'payroll' ? 'Salário por funcionário (R$)' : 'Valor (R$)'}
            placeholder="3500,00"
            value={amountReais}
            onChange={(e) => setAmountReais(e.target.value)}
            inputMode="decimal"
          />
        </div>

        {category === 'payroll' && (
          <div className="space-y-3">
            <Input
              label="Quantidade de funcionários"
              type="number"
              min={1}
              max={10000}
              step={1}
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
            />
            {unitCents !== null && validCount && (
              <p className="text-sm font-semibold" aria-live="polite">
                Total por pagamento:{' '}
                {(totalCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
              Recorrência
            </label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as ExpenseRecurrence)}
              className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm outline-none focus:border-brand-500"
            >
              {(Object.keys(EXPENSE_RECURRENCE_LABELS) as ExpenseRecurrence[]).map((r) => (
                <option key={r} value={r}>
                  {EXPENSE_RECURRENCE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {recurrence === 'monthly' && (
            <Input
              label="Dia do mês (1-28)"
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              placeholder="5"
            />
          )}
          {recurrence === 'weekly' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wider text-ink-secondary">
                Dia da semana
              </label>
              <select
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="h-11 rounded-lg border border-surface-border bg-surface-raised px-3 text-sm outline-none focus:border-brand-500"
              >
                <option value="">—</option>
                <option value="0">Domingo</option>
                <option value="1">Segunda</option>
                <option value="2">Terça</option>
                <option value="3">Quarta</option>
                <option value="4">Quinta</option>
                <option value="5">Sexta</option>
                <option value="6">Sábado</option>
              </select>
            </div>
          )}
          {(recurrence === 'one_time' || recurrence === 'daily') && (
            <Input
              label={recurrence === 'one_time' ? 'Data do pagamento' : 'Início'}
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
            />
          )}
        </div>

        {recurrence !== 'one_time' && recurrence !== 'daily' && (
          <Input
            label="Data de início"
            type="date"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            hint="Quando esta despesa começou. Default: hoje."
          />
        )}

        <Input
          label="Forma de pagamento (opcional)"
          placeholder="PIX, débito, dinheiro…"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
        />
        <Input label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Dialog>
  );
}
