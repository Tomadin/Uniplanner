import { T } from '../../design/tokens';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Misc';
import { IconButton } from '../ui/Button';
import { useAuthStore } from '../../auth/authStore';
import { useSyncStore } from '../../store/syncStore';
import { formatDate } from '../../utils/date';

type Route = 'dashboard' | 'calendar' | 'tasks-table' | 'tasks-tree' | 'subjects';

const NAV = [
  { id: 'dashboard',   label: 'Inicio',      icon: 'home'     },
  { id: 'calendar',    label: 'Agenda',      icon: 'calendar' },
  { id: 'tasks-table', label: 'Tareas',      icon: 'list'     },
  { id: 'tasks-tree',  label: 'Por materia', icon: 'tree'     },
  { id: 'subjects',    label: 'Materias',    icon: 'book'     },
] as const;

interface SidebarProps {
  active: Route;
  onNavigate: (r: Route) => void;
  onLogout: () => void;
}

export function Sidebar({ active, onNavigate, onLogout }: SidebarProps) {
  const { user } = useAuthStore();
  const { isSyncing, lastSyncAt, syncError } = useSyncStore();

  const syncLabel = syncError ? 'Fallo sync'
    : isSyncing ? 'Sincronizando…'
    : lastSyncAt ? `Sync ${formatDate(lastSyncAt, { withTime: true })}`
    : 'Pendiente';

  return (
    <div style={{
      width: 232, background: T.bg, borderRight: `1px solid ${T.line}`,
      display: 'flex', flexDirection: 'column', padding: '22px 14px',
      flexShrink: 0, height: '100%',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 26 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10, background: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.fontDisplay, fontSize: 18, color: '#FBFAF5', fontWeight: 500,
        }}>U</div>
        <div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 500, color: T.ink, letterSpacing: -0.2 }}>UniPlanner</div>
          <div style={{ fontSize: 10, color: T.inkMuted, fontFamily: T.fontUI, letterSpacing: 0.4 }}>v2.0 · personal</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(it => {
          const isActive = active === it.id;
          return (
            <button key={it.id} onClick={() => onNavigate(it.id as Route)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', fontSize: 14, fontFamily: T.fontUI,
              background: isActive ? T.surface : 'transparent',
              color: isActive ? T.ink : T.inkSoft,
              fontWeight: isActive ? 600 : 500,
              border: 'none', borderRadius: T.r2,
              cursor: 'pointer', textAlign: 'left',
              boxShadow: isActive ? T.shadowSm : 'none',
            }}>
              <Icon name={it.icon} size={18} stroke={isActive ? T.accent : T.inkSoft} />
              {it.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Sync status */}
      <div style={{
        padding: '10px 12px', marginBottom: 10, background: T.surface, borderRadius: T.r2,
        fontSize: 11, fontFamily: T.fontUI, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Icon name={isSyncing ? 'sync' : syncError ? 'wifiOff' : 'sync'} size={14}
          stroke={syncError ? T.danger : !isSyncing ? T.accent : T.inkSoft} />
        <div style={{ flex: 1, color: syncError ? T.danger : T.inkSoft }}>{syncLabel}</div>
      </div>

      {/* User */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        background: T.surface, borderRadius: T.r2,
      }}>
        <Avatar name={user?.name ?? '?'} size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: T.ink, fontFamily: T.fontUI, fontWeight: 500 }}>{user?.name}</div>
          <div style={{
            fontSize: 11, color: T.inkMuted, fontFamily: T.fontUI,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{user?.email}</div>
        </div>
        <IconButton icon="dots" size={26} onClick={onLogout} />
      </div>
    </div>
  );
}
