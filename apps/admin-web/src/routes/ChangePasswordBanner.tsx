import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export default function ChangePasswordBanner() {
  const { api, refreshSession } = useAuth();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');

  const handleSubmit = async () => {
    try {
      await api.changePassword({ currentPassword, nextPassword });
      push('Password updated.', 'success');
      setOpen(false);
      setCurrentPassword('');
      setNextPassword('');
      await refreshSession();
    } catch (error) {
      push((error as Error).message, 'error');
    }
  };

  return (
    <div className="mb-6 rounded-lg border border-warning-500/50 bg-panel-900 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-warning-500">Password update required</div>
          <div className="text-xs text-slate-400">
            Default admin credentials detected. Change your password to continue.
          </div>
        </div>
        <Button variant="ghost" onClick={() => setOpen(true)}>
          Change now
        </Button>
      </div>
      <Modal title="Change Password" open={open} onClose={() => setOpen(false)}>
        <div className="flex flex-col gap-3">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <Input
            label="New Password"
            type="password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Update</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
