import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AdminUser } from '@htown/admin-shared';
import { Button } from '../components/Button';
import { Input, Select } from '../components/Input';
import Modal from '../components/Modal';
import { formatDate } from '../utils/format';

export default function AdminUsersPage() {
  const { api } = useAuth();
  const { push } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminUser['role']>('ADMIN');

  const load = async () => {
    try {
      const list = await api.listAdminUsers();
      setUsers(list);
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async () => {
    try {
      await api.createAdminUser({ username, password, role });
      push('Admin user created.', 'success');
      setOpen(false);
      setUsername('');
      setPassword('');
      await load();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl">Admin Users</h1>
        <p className="text-sm text-slate-400">Manage admin accounts and permissions.</p>
      </div>
      <Button onClick={() => setOpen(true)}>Create admin user</Button>
      <div className="overflow-hidden rounded-xl border border-panel-700 bg-panel-900">
        <table className="w-full text-sm">
          <thead className="bg-panel-800 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3 text-left">Username</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-left">Must change password</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-panel-800">
                <td className="px-4 py-3 text-white">{user.username}</td>
                <td className="px-4 py-3 text-slate-300">{user.role}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(user.createdAt)}</td>
                <td className="px-4 py-3 text-slate-400">{user.mustChangePassword ? 'Yes' : 'No'}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                  No admin users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal title="Create Admin User" open={open} onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Input label="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <Input
            label="Temporary Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Select label="Role" value={role} onChange={(event) => setRole(event.target.value as any)}>
            <option value="OWNER">OWNER</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MOD">MOD</option>
            <option value="VIEWER">VIEWER</option>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
