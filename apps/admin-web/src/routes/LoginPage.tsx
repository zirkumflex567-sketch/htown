import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (error) {
      push((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-panel-700 bg-panel-900 p-8"
      >
        <div className="mb-6">
          <h1 className="font-display text-2xl text-white">HTOWN Admin Suite</h1>
          <p className="text-xs text-slate-400">Sign in to monitor and manage the live game.</p>
        </div>
        <div className="flex flex-col gap-4">
          <Input label="Username" value={username} onChange={(event) => setUsername(event.target.value)} />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button disabled={loading} type="submit">
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
          <p className="text-xs text-slate-500">
            Default admin login: admin / admin123. Change immediately after login.
          </p>
        </div>
      </form>
    </div>
  );
}
