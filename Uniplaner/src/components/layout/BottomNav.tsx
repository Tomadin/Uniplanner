import { T } from '../../design/tokens';
import { Icon } from '../ui/Icon';

type Route = 'dashboard' | 'calendar' | 'tasks-table' | 'tasks-tree' | 'subjects' | 'personal';

const NAV = [
  { id: 'dashboard',   label: 'Inicio',    icon: 'home'     },
  { id: 'calendar',    label: 'Agenda',    icon: 'calendar' },
  { id: 'tasks-table', label: 'Tareas',    icon: 'list'     },
  { id: 'subjects',    label: 'Materias',  icon: 'book'     },
  { id: 'personal',    label: 'Personal',  icon: 'heart'    },
] as const;

export function BottomNav({ active, onNavigate }: { active: Route; onNavigate: (r: Route) => void }) {
  return (
    <div style={{ display: 'flex', background: T.surface, borderTop: `1px solid ${T.line}`, padding: '6px 4px' }}>
      {NAV.map(it => {
        const isActive = active === it.id || (it.id === 'tasks-table' && active === 'tasks-tree');
        return (
          <button key={it.id} onClick={() => onNavigate(it.id as Route)} style={{
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
