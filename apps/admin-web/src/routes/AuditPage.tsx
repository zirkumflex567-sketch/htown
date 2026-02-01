import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import { AuditEntry } from '@htown/admin-shared';
import { formatDate } from '../utils/format';

export default function AuditPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(0);

  const load = async () => {
    try {
      const result = await api.listAudit({ page, pageSize });
      setEntries(result.data);
      setTotal(result.pagination.total);
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Audit Trail</h1>
        <p className="text-sm text-slate-400">Every action is captured with before/after state.</p>
      </div>
      <div className="space-y-3">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-panel-700 bg-panel-900 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{entry.action}</span>
              <span>{formatDate(entry.createdAt)}</span>
            </div>
            <div className="mt-1 text-sm text-white">
              {entry.targetType} · {entry.targetId ?? 'n/a'}
            </div>
            <div className="mt-2 grid gap-4 text-xs text-slate-400 md:grid-cols-2">
              <div>
                <div className="text-slate-500">Before</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(entry.before, null, 2)}</pre>
              </div>
              <div>
                <div className="text-slate-500">After</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(entry.after, null, 2)}</pre>
              </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-slate-500">No audit entries yet.</div>}
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </div>
  );
}
