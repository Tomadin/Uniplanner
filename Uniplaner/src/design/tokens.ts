export const T = {
  bg:         '#F6F3EC',
  bgAlt:      '#EFEAE0',
  surface:    '#FBFAF5',
  surfaceAlt: '#F1EDE3',
  ink:        '#2C2A26',
  inkSoft:    '#6B6860',
  inkMuted:   '#9A9689',
  line:       '#E4DED0',
  lineSoft:   '#EDE8DB',

  accent:     'oklch(0.55 0.12 145)',
  accentDim:  'oklch(0.80 0.06 145)',
  accentSoft: 'oklch(0.94 0.03 145)',
  accentInk:  'oklch(0.32 0.08 145)',

  danger:     'oklch(0.55 0.16 25)',
  dangerSoft: 'oklch(0.94 0.04 25)',
  warn:       'oklch(0.70 0.14 70)',
  warnSoft:   'oklch(0.95 0.05 70)',
  infoSoft:   'oklch(0.94 0.03 240)',

  shadowSm: '0 1px 2px rgba(44,42,38,0.04), 0 1px 0 rgba(44,42,38,0.02)',
  shadowMd: '0 2px 6px rgba(44,42,38,0.05), 0 8px 24px rgba(44,42,38,0.04)',
  shadowLg: '0 8px 24px rgba(44,42,38,0.08), 0 24px 60px rgba(44,42,38,0.06)',

  fontDisplay: '"Fraunces", Georgia, serif',
  fontUI:      '"Instrument Sans", system-ui, sans-serif',
  fontMono:    '"JetBrains Mono", Menlo, monospace',

  r1: 10, r2: 14, r3: 20, r4: 28, rFull: 9999,
} as const;

export type TaskPriorityKey = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatusKey   = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export const PRIORITY_META: Record<TaskPriorityKey, { label: string; short: string; bg: string; fg: string; dot: string; order: number }> = {
  NONE:   { label: 'Sin prioridad', short: '—', bg: '#EDE8DB', fg: '#6B6860', dot: '#B5B09F', order: 0 },
  LOW:    { label: 'Baja',          short: 'B', bg: '#E4EDE0', fg: '#4A5D3F', dot: '#8FAA7D', order: 1 },
  MEDIUM: { label: 'Media',         short: 'M', bg: '#EEE6D0', fg: '#6B5A2F', dot: '#C5A969', order: 2 },
  HIGH:   { label: 'Alta',          short: 'A', bg: '#F0D9C8', fg: '#7A4A2C', dot: '#D9946B', order: 3 },
  URGENT: { label: 'Urgente',       short: '!', bg: '#EDCDC9', fg: '#8B3A3A', dot: '#C56B64', order: 4 },
};

export const STATUS_META: Record<TaskStatusKey, { label: string; bg: string; fg: string }> = {
  NOT_STARTED: { label: 'Sin iniciar', bg: '#EDE8DB', fg: '#6B6860' },
  IN_PROGRESS: { label: 'En curso',    bg: '#E1EFE7', fg: '#2F5D45' },
  COMPLETED:   { label: 'Completada',  bg: '#D4E6D6', fg: '#3B6B44' },
  CANCELLED:   { label: 'Cancelada',   bg: '#E6E1D6', fg: '#8A8578' },
};

export const PRIORITY_CYCLE: TaskPriorityKey[] = ['NONE','LOW','MEDIUM','HIGH','URGENT'];
export const STATUS_CYCLE:   TaskStatusKey[]   = ['NOT_STARTED','IN_PROGRESS','COMPLETED','CANCELLED'];

export const SUBJECT_COLORS = [
  '#D98880','#85C1A1','#E8B86D','#A7C5E8','#C9A7E8','#B5B9AE',
  '#D4B08C','#9DC9B5','#E5A89B','#B3B8E5','#D8CF9B','#A7D4C4',
];
