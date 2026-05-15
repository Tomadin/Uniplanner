import { useState } from 'react';
import { T } from '../../design/tokens';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Misc';
import { IconButton } from '../ui/Button';
import { useAuthStore } from '../../auth/authStore';
import { useSyncStore } from '../../store/syncStore';
import { formatDate } from '../../utils/date';

type Route = 'dashboard' | 'calendar' | 'tasks-table' | 'tasks-tree' | 'subjects' | 'personal';

const NAV = [
  { id: 'dashboard',   label: 'Inicio',        icon: 'home'     },
  { id: 'calendar',    label: 'Agenda',        icon: 'calendar' },
  { id: 'tasks-table', label: 'Tareas',        icon: 'list'     },
  { id: 'tasks-tree',  label: 'Por materia',   icon: 'tree'     },
  { id: 'subjects',    label: 'Materias',      icon: 'book'     },
  { id: 'personal',    label: 'Vida personal', icon: 'heart'    },
] as const;

interface SidebarProps {
  active: Route;
  onNavigate: (r: Route) => void;
  onLogout: () => void;
  onSyncNow: () => void;
}

export function Sidebar({ active, onNavigate, onLogout, onSyncNow }: SidebarProps) {
  const { user } = useAuthStore();
  const { isSyncing, lastSyncAt, syncError } = useSyncStore();
  const [syncHover, setSyncHover] = useState(false);

  const syncLabel = syncError   ? 'Error — reintentar'
    : isSyncing                 ? 'Sincronizando…'
    : lastSyncAt                ? `Sync ${formatDate(lastSyncAt, { withTime: true })}`
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

      {/* Sync status — botón de sync manual */}
      <style>{`@keyframes up-spin { to { transform: rotate(360deg); } }`}</style>
      <button
        onClick={() => { if (!isSyncing) onSyncNow(); }}
        onMouseEnter={() => setSyncHover(true)}
        onMouseLeave={() => setSyncHover(false)}
        title={isSyncing ? 'Sincronizando…' : syncError ? 'Reintentar sync' : 'Sincronizar ahora'}
        style={{
          padding: '10px 12px', marginBottom: 10, width: '100%',
          background: syncHover && !isSyncing ? T.bgAlt : T.surface,
          borderRadius: T.r2, border: 'none', cursor: isSyncing ? 'default' : 'pointer',
          fontSize: 11, fontFamily: T.fontUI, display: 'flex', alignItems: 'center', gap: 8,
          transition: 'background 150ms', textAlign: 'left',
        }}
      >
        <span style={{
          display: 'inline-flex', flexShrink: 0,
          animation: isSyncing ? 'up-spin 1s linear infinite' : 'none',
        }}>
          <Icon
            name={syncError ? 'wifiOff' : 'sync'} size={14}
            stroke={syncError ? T.danger : isSyncing ? T.inkSoft : T.accent}
          />
        </span>
        <div style={{ flex: 1, color: syncError ? T.danger : T.inkSoft }}>{syncLabel}</div>
        {!isSyncing && (
          <Icon name="sync" size={11} stroke={T.inkMuted}
            style={{ opacity: syncHover ? 0.6 : 0, transition: 'opacity 150ms' }} />
        )}
      </button>

      {/* User */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
        background: T.surface, borderRadius: T.r2,
      }}>
        <Avatar name={user?.name ?? '?'} picture={user?.picture} size={30} />
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
