import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/logs', label: 'Logs' },
  { to: '/players', label: 'Players' },
  { to: '/rooms', label: 'Rooms' },
  { to: '/matches', label: 'Matches' },
  { to: '/config', label: 'Config' },
  { to: '/data', label: 'Data' },
  { to: '/assets', label: 'Assets' },
  { to: '/audit', label: 'Audit' },
  { to: '/admin-users', label: 'Admin Users' }
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="grid min-h-screen grid-cols-[260px_1fr]">
        <aside className="border-r border-panel-700 bg-panel-900 px-6 py-6">
          <div className="mb-10">
            <div className="font-display text-xl uppercase tracking-wide text-slate-50">HTOWN Admin</div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Ops Console</div>
          </div>
          <nav className="flex flex-col gap-2 text-sm">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 transition ${
                    isActive ? 'bg-panel-700 text-white' : 'text-slate-300 hover:bg-panel-800'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto pt-10 text-xs text-slate-400">
            <div className="mb-1">Signed in as</div>
            <div className="text-sm text-slate-200">{user?.username ?? 'Unknown'}</div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{user?.role}</div>
            <button
              type="button"
              className="mt-4 w-full rounded-md border border-panel-700 px-3 py-2 text-xs text-slate-300 hover:border-panel-500"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="min-h-screen px-10 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
