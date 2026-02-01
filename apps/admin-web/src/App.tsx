import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ToastShelf from './components/ToastShelf';
import LoginPage from './routes/LoginPage';
import DashboardPage from './routes/DashboardPage';
import LogsPage from './routes/LogsPage';
import PlayersPage from './routes/PlayersPage';
import RoomsPage from './routes/RoomsPage';
import MatchesPage from './routes/MatchesPage';
import ConfigPage from './routes/ConfigPage';
import DataPage from './routes/DataPage';
import AssetsPage from './routes/AssetsPage';
import AuditPage from './routes/AuditPage';
import AdminUsersPage from './routes/AdminUsersPage';
import ChangePasswordBanner from './routes/ChangePasswordBanner';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-8 text-slate-200">Loading session...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user, mustChangePassword } = useAuth();

  return (
    <>
      <ToastShelf />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <RequireAuth>
              <Layout>
                {mustChangePassword ? <ChangePasswordBanner /> : null}
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/logs" element={<LogsPage />} />
                  <Route path="/players" element={<PlayersPage />} />
                  <Route path="/rooms" element={<RoomsPage />} />
                  <Route path="/matches" element={<MatchesPage />} />
                  <Route path="/config" element={<ConfigPage />} />
                  <Route path="/data" element={<DataPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/audit" element={<AuditPage />} />
                  <Route path="/admin-users" element={<AdminUsersPage />} />
                </Routes>
              </Layout>
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}
