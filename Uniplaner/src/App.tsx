import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './auth/authStore';
import { useAuth } from './auth/GoogleAuthProvider';
import { useSync } from './hooks/useSync';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { SyncBanner } from './components/layout/SyncBanner';
import { LoginScreen } from './pages/LoginScreen';
import { Dashboard } from './pages/Dashboard';
import { Calendar } from './pages/Calendar';
import { TasksTable } from './pages/TasksTable';
import { TasksTree } from './pages/TasksTree';
import { Subjects } from './pages/Subjects';
import { T } from './design/tokens';

const qc = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30, gcTime: 1000 * 60 * 5 } },
});

type Route = 'dashboard' | 'calendar' | 'tasks-table' | 'tasks-tree' | 'subjects';

// ─── Inner app (necesita QueryClientProvider ya montado) ──────────────────────

function AppInner() {
  const { isAuthenticated } = useAuthStore();
  const { logout } = useAuth();
  const { syncNow } = useSync();
  const [route, setRoute] = useState<Route>('dashboard');
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  if (!isAuthenticated) return <LoginScreen />;

  const navigate = (r: string) => setRoute(r as Route);

  const page = route === 'dashboard'   ? <Dashboard onNavigate={navigate} />
             : route === 'calendar'    ? <Calendar />
             : route === 'tasks-table' ? <TasksTable />
             : route === 'tasks-tree'  ? <TasksTree />
             : route === 'subjects'    ? <Subjects />
             : null;

  if (mobile) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: T.bg }}>
        <SyncBanner onRetry={syncNow} />
        <div className="up-scroll" style={{ flex: 1, overflow: 'auto' }}>{page}</div>
        <BottomNav active={route} onNavigate={setRoute} />
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', background: T.bg }}>
      <Sidebar active={route} onNavigate={setRoute} onLogout={logout} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <SyncBanner onRetry={syncNow} />
        {(route === 'tasks-table' || route === 'tasks-tree') && (
          <div style={{ padding: '8px 32px 0', background: T.bg, display: 'flex', gap: 6 }}>
            {([['tasks-table','Tabla','list'],['tasks-tree','Por materia','tree']] as const).map(([id,label]) => (
              <button key={id} onClick={() => setRoute(id)} style={{
                padding: '6px 14px', fontSize: 12, fontFamily: T.fontUI,
                background: route === id ? T.accentSoft : 'transparent',
                color: route === id ? T.accentInk : T.inkSoft,
                border: 'none', borderRadius: T.rFull, cursor: 'pointer', fontWeight: 500,
              }}>{label}</button>
            ))}
          </div>
        )}
        <div className="up-scroll" style={{ flex: 1, overflow: 'auto' }}>{page}</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInner />
    </QueryClientProvider>
  );
}
