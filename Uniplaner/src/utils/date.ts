const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DAYS   = ['dom','lun','mar','mié','jue','vie','sáb'];

export function formatDate(iso: string | null, opts: {
  withDay?: boolean; withTime?: boolean; timeOnly?: boolean;
} = {}): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (opts.timeOnly) return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  if (opts.withDay)  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  if (opts.withTime) return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function daysBetween(isoA: string, isoB: Date | string): number {
  const a = new Date(isoA); a.setHours(0,0,0,0);
  const b = new Date(isoB instanceof Date ? isoB : isoB); b.setHours(0,0,0,0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

export function relativeLabel(iso: string | null, now: Date): string {
  if (!iso) return '';
  const diff = daysBetween(iso, now);
  if (diff === 0)  return 'Hoy';
  if (diff === 1)  return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff <= 7)   return `en ${diff} días`;
  if (diff < -1 && diff >= -7) return `hace ${-diff} días`;
  return formatDate(iso, { withDay: true });
}
