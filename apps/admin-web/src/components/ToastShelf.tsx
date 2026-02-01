import { useToast } from '../context/ToastContext';

const toneClasses: Record<string, string> = {
  info: 'border-slate-600 bg-panel-800',
  success: 'border-accent-500 bg-panel-800',
  warning: 'border-warning-500 bg-panel-800',
  error: 'border-danger-500 bg-panel-800'
};

export default function ToastShelf() {
  const { toasts, remove } = useToast();
  return (
    <div className="fixed right-6 top-6 z-50 flex w-80 flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg border px-4 py-3 text-sm shadow-lg ${toneClasses[toast.tone ?? 'info']}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span>{toast.message}</span>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-white"
              onClick={() => remove(toast.id)}
            >
              Close
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
