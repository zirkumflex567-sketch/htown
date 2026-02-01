import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import { Input, Select } from '../components/Input';
import { Button } from '../components/Button';
import Modal from '../components/Modal';
import { Room } from '@htown/admin-shared';
import { formatDate } from '../utils/format';

export default function RoomsPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Room | null>(null);
  const [action, setAction] = useState<'kick' | 'close'>('close');
  const [reason, setReason] = useState('');

  const load = async () => {
    try {
      const result = await api.listRooms({ q: query || undefined, page, pageSize });
      setRooms(result.data);
      setTotal(result.pagination.total);
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  useEffect(() => {
    void load();
  }, [page, query]);

  const handleAction = async () => {
    if (!selected) return;
    try {
      await api.actOnRoom(selected.id, { action, reason: reason || undefined });
      push(`Room ${action} action applied.`, 'success');
      setSelected(null);
      setReason('');
      await load();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Rooms</h1>
        <p className="text-sm text-slate-400">Inspect lobbies and apply moderation controls.</p>
      </div>
      <div className="flex items-end gap-3">
        <Input label="Search" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button onClick={() => setPage(1)}>Apply</Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-panel-700 bg-panel-900">
        <table className="w-full text-sm">
          <thead className="bg-panel-800 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Room</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Players</th>
              <th className="px-4 py-3 text-left">Updated</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-t border-panel-800">
                <td className="px-4 py-3">
                  <div className="text-white">{room.id}</div>
                  <div className="text-xs text-slate-500">Mode: {room.mode ?? 'n/a'}</div>
                </td>
                <td className="px-4 py-3 text-slate-300">{room.status}</td>
                <td className="px-4 py-3 text-slate-300">
                  {room.playerCount} / {room.maxPlayers}
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(room.updatedAt)}</td>
                <td className="px-4 py-3">
                  <Button variant="ghost" onClick={() => setSelected(room)}>
                    Action
                  </Button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={5}>
                  No rooms found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />

      <Modal title="Room Action" open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected && (
          <div className="space-y-4">
            <div>
              <div className="text-sm text-white">{selected.id}</div>
              <div className="text-xs text-slate-400">Status: {selected.status}</div>
            </div>
            <Select label="Action" value={action} onChange={(event) => setAction(event.target.value as any)}>
              <option value="close">Close room</option>
              <option value="kick">Kick player</option>
            </Select>
            <Input label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button onClick={handleAction}>Confirm</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
