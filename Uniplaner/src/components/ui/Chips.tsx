import { T, PRIORITY_META, STATUS_META } from '../../design/tokens';
import type { TaskPriorityKey, TaskStatusKey } from '../../design/tokens';
import type { Subject } from '../../types';

interface ChipProps { compact?: boolean; onClick?: () => void; }

export function PriorityChip({ value, compact, onClick }: { value: TaskPriorityKey } & ChipProps) {
  const p = PRIORITY_META[value];
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: compact ? '2px 8px' : '4px 10px',
      borderRadius: T.rFull, background: p.bg, color: p.fg,
      fontSize: compact ? 11 : 12, fontWeight: 500, fontFamily: T.fontUI,
      letterSpacing: 0.1, cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 3, background: p.dot }} />
      {p.label}
    </span>
  );
}

export function StatusChip({ value, compact, onClick }: { value: TaskStatusKey } & ChipProps) {
  const s = STATUS_META[value];
  return (
    <span onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center',
      padding: compact ? '2px 8px' : '4px 10px',
      borderRadius: T.rFull, background: s.bg, color: s.fg,
      fontSize: compact ? 11 : 12, fontWeight: 500, fontFamily: T.fontUI,
      letterSpacing: 0.1, cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap',
      border: onClick ? '1.5px solid rgba(0,0,0,0.07)' : 'none',
      transition: 'background 200ms ease, color 200ms ease',
    }}>{s.label}</span>
  );
}

export function SubjectChip({ subject, compact }: { subject?: Subject | null } & ChipProps) {
  if (!subject) return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      color: T.inkMuted, fontSize: compact ? 11 : 12,
      fontFamily: T.fontUI, fontStyle: 'italic',
    }}>— General</span>
  );
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: compact ? '2px 8px' : '3px 10px',
      borderRadius: T.rFull,
      background: subject.color + '26',
      color: T.ink,
      fontSize: compact ? 11 : 12, fontWeight: 500, fontFamily: T.fontUI, whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 3.5, background: subject.color }} />
      {subject.name}
    </span>
  );
}
