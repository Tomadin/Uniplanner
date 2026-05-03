import { T } from '../../design/tokens';
import { Icon } from '../ui/Icon';
import { useSyncStore } from '../../store/syncStore';

interface BannerProps { onRetry: () => void; }

export function SyncBanner({ onRetry }: BannerProps) {
  const { isSyncing, syncError, clearSyncError } = useSyncStore();

  if (!syncError && !isSyncing) return null;

  const cfg = isSyncing
    ? { bg: T.infoSoft, fg: '#2F4E7A', icon: 'sync', text: 'Sincronizando con Google Drive…', action: null }
    : { bg: T.dangerSoft, fg: '#7A2F2F', icon: 'wifiOff', text: syncError, action: 'Reintentar' };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 18px', background: cfg.bg, color: cfg.fg,
      fontSize: 13, fontFamily: T.fontUI, borderBottom: `1px solid ${T.line}`,
    }}>
      <Icon name={cfg.icon} size={16} />
      <div style={{ flex: 1 }}>{cfg.text}</div>
      {cfg.action && (
        <button onClick={onRetry} style={{
          fontSize: 12, padding: '4px 12px', background: 'transparent',
          border: `1px solid currentColor`, borderRadius: T.rFull,
          cursor: 'pointer', color: 'inherit', fontFamily: T.fontUI, fontWeight: 500,
        }}>{cfg.action}</button>
      )}
      <button onClick={clearSyncError} style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'inherit', padding: 4, opacity: 0.7,
      }}><Icon name="x" size={14} /></button>
    </div>
  );
}
