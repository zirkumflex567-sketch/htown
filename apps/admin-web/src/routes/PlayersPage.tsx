import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import { Input, TextArea } from '../components/Input';
import { Button } from '../components/Button';
import Modal from '../components/Modal';
import { Player } from '@htown/admin-shared';
import { formatDate } from '../utils/format';

export default function PlayersPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Player | null>(null);
  const [notes, setNotes] = useState('');
  const [flagInput, setFlagInput] = useState('');

  const load = async () => {
    try {
      const result = await api.listPlayers({ q: query || undefined, page, pageSize });
      setPlayers(result.data);
      setTotal(result.pagination.total);
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  useEffect(() => {
    void load();
  }, [page, query]);

  const openModal = (player: Player) => {
    setSelected(player);
    setNotes(player.notes ?? '');
    setFlagInput(player.flags.join(','));
  };

  const handleBan = async (days: number | null) => {
    if (!selected) return;
    const until = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
    try {
      await api.banPlayer(selected.id, { until });
      push(days ? `Player banned for ${days} days.` : 'Player unbanned.', 'success');
      setSelected(null);
      await load();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  const handleMute = async (days: number | null) => {
    if (!selected) return;
    const until = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
    try {
      await api.mutePlayer(selected.id, { until });
      push(days ? `Player muted for ${days} days.` : 'Player unmuted.', 'success');
      setSelected(null);
      await load();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    try {
      await api.updatePlayerNotes(selected.id, { notes });
      await api.updatePlayerFlags(selected.id, {
        flags: flagInput
          .split(',')
          .map((flag) => flag.trim())
          .filter(Boolean)
      });
      push('Player notes updated.', 'success');
      setSelected(null);
      await load();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Players</h1>
        <p className="text-sm text-slate-400">Search accounts, review notes, and apply moderation actions.</p>
      </div>
      <div className="flex items-end gap-3">
        <Input label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button onClick={() => setPage(1)}>Apply</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-panel-700 bg-panel-900">
        <table className="w-full text-sm">
          <thead className="bg-panel-800 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Player</th>
              <th className="px-4 py-3 text-left">Last Seen</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className="border-t border-panel-800">
                <td className="px-4 py-3">
                  <div className="text-white">{player.displayName}</div>
                  <div className="text-xs text-slate-500">{player.id}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{formatDate(player.lastSeenAt)}</td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {player.bannedUntil ? `Banned until ${formatDate(player.bannedUntil)}` : 'Active'}
                  {player.mutedUntil ? ` · Muted until ${formatDate(player.mutedUntil)}` : ''}
                </td>
                <td className="px-4 py-3">
                  <Button variant="ghost" onClick={() => openModal(player)}>
                    Manage
                  </Button>
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                  No players found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal title="Manage Player" open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-white">{selected.displayName}</div>
              <div className="text-xs text-slate-400">{selected.id}</div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Button variant="ghost" onClick={() => handleBan(7)}>
                Ban 7 days
              </Button>
              <Button variant="ghost" onClick={() => handleBan(null)}>
                Unban
              </Button>
              <Button variant="ghost" onClick={() => handleMute(2)}>
                Mute 2 days
              </Button>
              <Button variant="ghost" onClick={() => handleMute(null)}>
                Unmute
              </Button>
            </div>
            <TextArea label="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
            <TextArea
              label="Flags (comma separated)"
              value={flagInput}
              onChange={(event) => setFlagInput(event.target.value)}
            />
            <div className="text-xs text-slate-500">
              Sessions and inventory data are not connected in the stub adapter.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveNotes}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
