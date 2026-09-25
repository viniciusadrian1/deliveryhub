'use client';

import { Button } from './button';
import { Dialog } from './dialog';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ConfirmOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
};

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);
  const confirm = useMemo(() => (options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ options, resolve })), []);
  const finish = (value: boolean) => {
    request?.resolve(value);
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!request}
        title={request?.options.title ?? ''}
        description={request?.options.description ?? ''}
        confirmLabel={request?.options.confirmLabel}
        danger={request?.options.danger}
        onClose={() => finish(false)}
        onConfirm={() => finish(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
  return confirm;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button></>}
    >
      <p className="text-sm text-ink-secondary">{description}</p>
    </Dialog>
  );
}
