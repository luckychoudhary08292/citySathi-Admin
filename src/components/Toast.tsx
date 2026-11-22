import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-[110] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const ringTone =
          toast.type === 'success'
            ? 'border-emerald-200 bg-white'
            : toast.type === 'error'
              ? 'border-red-200 bg-white'
              : 'border-sky-200 bg-white';

        const iconWrap =
          toast.type === 'success'
            ? 'bg-emerald-50 text-emerald-600'
            : toast.type === 'error'
              ? 'bg-red-50 text-red-600'
              : 'bg-sky-50 text-sky-600';

        const Icon =
          toast.type === 'success'
            ? CheckCircle2
            : toast.type === 'error'
              ? AlertCircle
              : Info;

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-slate-900/5 transition-all ${ringTone}`}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-sm font-medium text-slate-900 leading-snug flex-1">
              {toast.message}
            </p>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
