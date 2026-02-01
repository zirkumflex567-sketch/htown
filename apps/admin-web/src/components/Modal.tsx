export default function Modal({
  title,
  open,
  onClose,
  children
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-panel-700 bg-panel-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg text-slate-100">{title}</h2>
          <button className="text-sm text-slate-400 hover:text-white" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
