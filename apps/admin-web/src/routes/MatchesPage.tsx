import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import Modal from '../components/Modal';
import { Match } from '@htown/admin-shared';
import { formatDate } from '../utils/format';

export default function MatchesPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Match | null>(null);

  const load = async () => {
    try {
      const result = await api.listMatches({ q: query || undefined, page, pageSize });
      setMatches(result.data);
      setTotal(result.pagination.total);
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  useEffect(() => {
    void load();
  }, [page, query]);

  const handleClose = async () => {
    if (!selected) return;
    try {
      await api.actOnMatch(selected.id, { action: 'close' });
      push('Match closed.', 'success');
      setSelected(null);
      await load();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Matches</h1>
        <p className="text-sm text-slate-400">Review match history and intervene when needed.</p>
      </div>
      <div className="flex items-end gap-3">
        <Input label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button onClick={() => setPage(1)}>Apply</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-panel-700 bg-panel-900">
        <table className="w-full text-sm">
          <thead className="bg-panel-800 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Match</th>
              <th className="px-4 py-3 text-left">Room</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Started</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id} className="border-t border-panel-800">
                <td className="px-4 py-3">
                  <div className="text-white">{match.id}</div>
                  <div className="text-xs text-slate-500">{match.summary ? 'Summary attached' : 'No summary'}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{match.roomId ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300">{match.status}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(match.startedAt)}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" onClick={() => setSelected(match)}>
                    Action
                  </Button>
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  No matches found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal title="Match Action" open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-white">{selected.id}</div>
              <div className="text-xs text-slate-400">Status: {selected.status}</div>
            </div>
            <p className="text-sm text-slate-400">Close this match and end it server-side.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleClose}>
                Close match
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
