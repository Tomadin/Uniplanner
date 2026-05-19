import { useNavigate, useLocation } from 'react-router-dom';
import { T } from '../../design/tokens';
import { Icon } from '../ui/Icon';

const NAV = [
  { path: '/',            label: 'Inicio',    icon: 'home'     },
  { path: '/calendar',    label: 'Agenda',    icon: 'calendar' },
  { path: '/tasks-table', label: 'Tareas',    icon: 'list'     },
  { path: '/subjects',    label: 'Materias',  icon: 'book'     },
  { path: '/personal',    label: 'Personal',  icon: 'heart'    },
] as const;

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div style={{ display: 'flex', background: T.surface, borderTop: `1px solid ${T.line}`, padding: '6px 4px' }}>
      {NAV.map(it => {
        const isActive = location.pathname === it.path ||
          (it.path === '/tasks-table' && location.pathname === '/tasks-tree');
        return (
          <button key={it.path} onClick={() => navigate(it.path)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 0', background: 'transparent', border: 'none', cursor: 'pointer',
            color: isActive ? T.accent : T.inkMuted, fontFamily: T.fontUI,
          }}>
            <Icon name={it.icon} size={20} stroke={isActive ? T.accent : T.inkMuted} strokeWidth={isActive ? 2 : 1.6} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 500, letterSpacing: 0.2 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
