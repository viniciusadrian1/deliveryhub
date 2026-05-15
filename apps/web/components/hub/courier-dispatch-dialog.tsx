'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck } from 'lucide-react';
import { useState } from 'react';

import { api, ApiError } from '../../lib/api';
import { Button } from '../ui/button';
import { Dialog } from '../ui/dialog';

const VEHICLES = [
  { value: 102, label: 'Moto' },
  { value: 101, label: 'E-bike' },
  { value: 103, label: 'Bicicleta' },
  { value: 104, label: 'Carro' },
  { value: 100, label: 'A pé' },
  { value: 105, label: 'Moto 125cc' },
];

const FIELD =
  'w-full rounded-lg border border-surface-border bg-surface-base px-3 py-2 text-sm text-ink-primary placeholder:text-ink-tertiary focus:border-brand-500 focus:outline-none';
const LABEL =
  'text-[10px] font-semibold uppercase tracking-wider text-ink-tertiary';

/**
 * Despacho de pedido de entrega própria do 99Food — coleta os dados do
 * entregador da loja e envia para a plataforma (Self Delivery).
 */
export function CourierDispatchDialog({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState('+55');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState(102);
  const [etaMinutes, setEtaMinutes] = useState(40);

  const dispatch = useMutation({
    mutationFn: async () =>
      api(`/orders/${orderId}/dispatch-self`, {
        method: 'POST',
        body: {
          courierName: name.trim(),
          courierPhone: phone.trim(),
          courierPhoneCode: phoneCode.trim(),
          vehicleType,
          etaMinutes,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
      void qc.invalidateQueries({ queryKey: ['order', orderId] });
      onClose();
    },
  });

  const valid = name.trim().length > 0 && phone.trim().length > 0;
  const err = dispatch.error as ApiError | null;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Despachar com entregador próprio"
      description="Os dados do entregador são enviados ao 99Food para o cliente acompanhar."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => dispatch.mutate()}
            loading={dispatch.isPending}
            disabled={!valid}
            leftIcon={!dispatch.isPending && <Truck className="h-4 w-4" />}
          >
            Despachar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Nome do entregador</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: João Silva"
            className={`mt-1 ${FIELD}`}
            autoFocus
          />
        </div>

        <div>
          <label className={LABEL}>Telefone</label>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={phoneCode}
              onChange={(e) => setPhoneCode(e.target.value)}
              className={`${FIELD} w-20 shrink-0`}
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999998888"
              className={FIELD}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className={LABEL}>Veículo</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(Number(e.target.value))}
              className={`mt-1 ${FIELD}`}
            >
              {VEHICLES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-32 shrink-0">
            <label className={LABEL}>Entrega em (min)</label>
            <input
              type="number"
              min={5}
              max={180}
              value={etaMinutes}
              onChange={(e) => setEtaMinutes(Number(e.target.value))}
              className={`mt-1 ${FIELD}`}
            />
          </div>
        </div>

        {err && (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-bright">
            Não foi possível despachar — verifique os dados e tente de novo.
          </p>
        )}
      </div>
    </Dialog>
  );
}
