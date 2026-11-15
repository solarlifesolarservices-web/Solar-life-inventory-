import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  RotateCcw,
  ShieldAlert,
  Truck,
  Wrench,
} from 'lucide-react';
import { SerialStatus, TransactionType } from '../types/inventory';

export const StatusLabel: React.FC<{ status: SerialStatus }> = ({ status }) => {
  switch (status) {
    case 'In Stock':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          In Stock
        </span>
      );
    case 'Issued':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
          <Truck className="w-3.5 h-3.5 shrink-0" />
          Issued
        </span>
      );
    case 'Installed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
          <Wrench className="w-3.5 h-3.5 shrink-0" />
          Installed
        </span>
      );
    case 'Returned':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          Returned
        </span>
      );
    case 'Damaged':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          Damaged
        </span>
      );
  }
};

export const TransactionTypeLabel: React.FC<{ type: TransactionType }> = ({ type }) => {
  switch (type) {
    case 'INWARD':
      return <span className="text-xs font-semibold text-emerald-700">Stock Inward</span>;
    case 'OUTWARD':
      return <span className="text-xs font-semibold text-blue-700">Stock Issued</span>;
    case 'INSTALLED':
      return <span className="text-xs font-semibold text-indigo-700">Installed</span>;
    case 'RETURN':
      return <span className="text-xs font-semibold text-amber-700">Material Returned</span>;
    case 'DAMAGED':
      return <span className="text-xs font-semibold text-red-700">Marked Damaged</span>;
    case 'RESTORE_STOCK':
      return <span className="text-xs font-semibold text-emerald-700">Restored to Stock</span>;
  }
};

export const ConfirmModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              danger ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`min-h-[44px] px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mx-auto">
      <Package className="w-6 h-6" />
    </div>
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <p className="text-sm text-slate-600 max-w-sm mx-auto">{description}</p>
    {actionLabel && onAction && (
      <div className="pt-1">
        <button
          type="button"
          onClick={onAction}
          className="min-h-[44px] px-5 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 transition-colors"
        >
          {actionLabel}
        </button>
      </div>
    )}
  </div>
);
