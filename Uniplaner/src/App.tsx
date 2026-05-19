import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './auth/authStore';
import { useAuth } from './auth/GoogleAuthProvider';
import { useSync } from './hooks/useSync';
import { useResponsive } from './hooks/useResponsive';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { SyncBanner } from './components/layout/SyncBanner';
import { LoginScreen } from './pages/LoginScreen';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { TasksTable } from './pages/TasksTable';
import { TasksTree } from './pages/TasksTree';
import { Subjects } from './pages/Subjects';
import { PersonalLife } from './pages/PersonalLife';
import { T } from './design/tokens';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, gcTime: 1000 * 60 * 5 } },
});

// ─── Inner app (necesita QueryClientProvider y BrowserRouter ya montados) ─────

function AppInner() {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const { logout } = useAuth();
  const { syncNow } = useSync();
  const navigate = useNavigate();
  const location = useLocation();
  const { mobile } = useResponsive();

  if (isInitializing) return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: T.bg, flexDirection: 'column', gap: 16,
    }}>
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
        <circle cx="20" cy="20" r="16" stroke={T.line} strokeWidth="3" />
        <path d="M20 4a16 16 0 0116 16" stroke={T.accent} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!isAuthenticated) return <LoginScreen />;

  const pages = (
    <Routes>
      <Route path="/"            element={<Dashboard />} />
      <Route path="/calendar"    element={<Calendar />} />
      <Route path="/tasks-table" element={<TasksTable />} />
      <Route path="/tasks-tree"  element={<TasksTree />} />
      <Route path="/subjects"    element={<Subjects />} />
      <Route path="/personal"    element={<PersonalLife />} />
      <Route path="*"            element={<Dashboard />} />
    </Routes>
  );

  const isTasksRoute = location.pathname === '/tasks-table' || location.pathname === '/tasks-tree';

  if (mobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <SyncBanner onSync={syncNow} />
        <div className="up-scroll" style={{ flex: 1, overflow: 'auto' }}>{pages}</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: T.bg }}>
      <Sidebar onLogout={logout} onSyncNow={syncNow} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <SyncBanner onSync={syncNow} />
        {isTasksRoute && (
          <div style={{ padding: '8px 32px 0', background: T.bg, display: 'flex', gap: 6 }}>
            {(['/tasks-table', '/tasks-tree'] as const).map((path, i) => (
              <button key={path} onClick={() => navigate(path)} style={{
                padding: '6px 14px', fontSize: 12, fontFamily: T.fontUI,
                background: location.pathname === path ? T.accentSoft : 'transparent',
                color: location.pathname === path ? T.accentInk : T.inkSoft,
                border: 'none', borderRadius: T.rFull, cursor: 'pointer', fontWeight: 500,
              }}>{i === 0 ? 'Tabla' : 'Por materia'}</button>
            ))}
          </div>
        )}
        <div className="up-scroll" style={{ flex: 1, overflow: 'auto' }}>{pages}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={qc}>
        <AppInner />
      </QueryClientProvider>
    </BrowserRouter>
  );
}
