import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useResponsive } from '../hooks/useResponsive';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import type { EventClickArg, DateSelectArg, EventInput } from '@fullcalendar/core';
import { RRule } from 'rrule';
import { T, darkenHex, withAlpha, SUBJECT_COLORS } from '../design/tokens';
import { Button, Checkbox, IconButton } from '../components/ui/Button';
import { DateInput } from '../components/ui/DateInput';
import { SectionTitle } from '../components/ui/Misc';
import { useSubjects } from '../hooks/useSubjects';
import { useEvents, useAddEvent, useUpdateEvent, useDeleteEvent } from '../hooks/useEvents';
import { useTasks } from '../hooks/useTasks';
import type { Event as UPEvent, Subject } from '../types';

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function localDateStr(isoStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return isoStr;
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(isoStr: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoStr)) return '';
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ─── Modal de crear / editar evento ──────────────────────────────────────────

interface EventModalProps {
  event?: UPEvent;
  defaultStart?: string;
  defaultEnd?: string;
  subjects: Subject[];
  isSaving: boolean;
  saveError: string | null;
  onSave: (data: Omit<UPEvent, 'id' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
  mobile?: boolean;
}

function EventModal({ event, defaultStart, defaultEnd, subjects, isSaving, saveError, onSave, onDelete, onClose, mobile }: EventModalProps) {
  const toLocal = (iso?: string) => {
    if (!iso) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso + 'T00:00';
    if (!iso.endsWith('Z') && !iso.includes('+')) return iso.slice(0, 16);
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [title,      setTitle]      = useState(event?.title ?? '');
  const [start,      setStart]      = useState(toLocal(event?.startTime ?? defaultStart));
  const [end,        setEnd]        = useState(toLocal(event?.endTime   ?? defaultEnd));
  const [subjId,     setSubjId]     = useState(event?.subjectId ?? '');
  const [isExam,     setIsExam]     = useState(event?.isExam ?? false);
  const [rrule,      setRrule]      = useState(event?.recurrenceRule ?? '');
  const [endDate,    setEndDate]    = useState(event?.recurrenceEndDate?.slice(0, 10) ?? '');
  const [customColor, setCustomColor] = useState<string>(event?.customColor ?? '');
  const [confirmDel,  setConfirmDel]  = useState(false);

  const valid = title.trim() && start && end;
  const isRecurring = !!event?.recurrenceRule;

  const submit = () => {
    if (!valid || isSaving) return;
    onSave({
      title: title.trim(),
      startTime: new Date(start).toISOString(),
      endTime:   new Date(end).toISOString(),
      subjectId: subjId || null,
      isExam,
      recurrenceRule:    rrule || null,
      recurrenceEndDate: (rrule && endDate) ? new Date(endDate).toISOString() : null,
      customColor: customColor || null,
    });
  };

  const INPUT: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 14,
    fontFamily: T.fontUI, background: T.surfaceAlt,
    border: `1px solid ${T.line}`, borderRadius: T.r1,
    color: T.ink, outline: 'none', boxSizing: 'border-box',
  };

  const LABEL: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: 0.7,
    textTransform: 'uppercase', color: T.inkMuted,
    fontFamily: T.fontUI, marginBottom: 6, display: 'block',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(44,42,38,0.35)',
      display: 'flex',
      alignItems: mobile ? 'flex-end' : 'center',
      justifyContent: 'center',
      zIndex: 1000, padding: mobile ? 0 : 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.surface,
        borderRadius: mobile ? '28px 28px 0 0' : T.r4,
        padding: mobile ? '20px 16px 32px' : 28,
        width: '100%', maxWidth: mobile ? '100%' : 480,
        boxShadow: T.shadowLg,
        border: `1px solid ${T.line}`,
        borderBottom: mobile ? 'none' : `1px solid ${T.line}`,
        maxHeight: mobile ? '92dvh' : 'calc(100dvh - 80px)',
        overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <SectionTitle size="md" style={{ flex: 1 }}>
            {event ? 'Editar evento' : 'Nuevo evento'}
          </SectionTitle>
          <IconButton icon="x" size={28} onClick={onClose} />
        </div>

        {isRecurring && (
          <div style={{
            background: T.warnSoft, border: `1px solid ${T.warn}55`,
            borderRadius: T.r1, padding: '8px 12px',
            fontSize: 12, fontFamily: T.fontUI, color: T.inkSoft,
            marginBottom: 14,
          }}>
            Este es un evento recurrente. Los cambios afectarán todas las ocurrencias.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={LABEL}>Título</label>
            <input style={INPUT} autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Parcial de Anatomía" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={LABEL}>Inicio</label>
              <input lang="es-AR" style={INPUT} type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Fin</label>
              <input lang="es-AR" style={INPUT} type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={LABEL}>Materia (opcional)</label>
            <select style={INPUT} value={subjId} onChange={e => setSubjId(e.target.value)}>
              <option value="">— General</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL}>Color</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setCustomColor('')}
                title="Color automático"
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: T.bgAlt,
                  border: customColor === '' ? `2px solid ${T.ink}` : `2px solid ${T.line}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: T.inkMuted, flexShrink: 0,
                }}
              >✕</button>
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCustomColor(c)}
                  style={{
                    width: 26, height: 26, borderRadius: '50%', background: c, flexShrink: 0,
                    border: customColor === c ? `2px solid ${T.ink}` : '2px solid transparent',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <label style={LABEL}>Repetición</label>
            <select style={INPUT} value={rrule} onChange={e => setRrule(e.target.value)}>
              <option value="">Sin repetición</option>
              <option value="FREQ=DAILY">Diario</option>
              <option value="FREQ=WEEKLY">Semanal (mismo día)</option>
              <option value="FREQ=WEEKLY;BYDAY=MO,WE,FR">Lunes, Miércoles, Viernes</option>
              <option value="FREQ=WEEKLY;BYDAY=TU,TH">Martes y Jueves</option>
              <option value="FREQ=MONTHLY">Mensual</option>
            </select>
          </div>

          {rrule && (
            <div>
              <label style={LABEL}>Repetir hasta (opcional)</label>
              <DateInput style={INPUT} value={endDate} onChange={setEndDate} />
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Checkbox checked={isExam} onChange={v => setIsExam(v)} />
            <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.inkSoft }}>
              Marcar como examen
            </span>
          </label>
        </div>

        {saveError && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: T.r1,
            background: T.dangerSoft, fontSize: 12,
            fontFamily: T.fontUI, color: T.danger,
          }}>
            {saveError}
          </div>
        )}

        {confirmDel ? (
          <div style={{
            marginTop: 20, padding: '12px 14px', borderRadius: T.r2,
            background: T.dangerSoft, border: `1px solid ${T.danger}44`,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.ink }}>
              ¿Eliminar "{event?.title}"? Esta acción no se puede deshacer.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="danger" size="sm" onClick={onDelete}>Sí, eliminar</Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            {onDelete && <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>Eliminar</Button>}
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" size="sm" disabled={!valid || isSaving} onClick={submit}>
              {isSaving ? 'Guardando…' : event ? 'Guardar cambios' : 'Crear evento'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expansión de eventos recurrentes para FullCalendar ────────────────────────

function expandToFC(events: UPEvent[], tasks: ReturnType<typeof useTasks>['data'], subjects: Subject[]): EventInput[] {
  const subjectById = Object.fromEntries(subjects.map(s => [s.id, s]));
  const result: EventInput[] = [];
  const RANGE_FUTURE = new Date(Date.now() + 365 * 24 * 3600 * 1000);

  for (const ev of events) {
    const subj = ev.subjectId ? subjectById[ev.subjectId] : null;
    const color = ev.customColor ?? (ev.isExam ? T.danger : (subj?.color ?? T.accent));
    const isRecurring = !!ev.recurrenceRule;
    const isSolid = ev.isExam || (!!subj && isRecurring);
    const textColor = color.startsWith('#') && color.length === 7 ? darkenHex(color) : (isSolid ? '#fff' : T.inkSoft);
    const base: EventInput = {
      id: ev.id,
      title: ev.title,
      backgroundColor: isSolid ? color : withAlpha(color, 0.16),
      borderColor:     isSolid ? color : withAlpha(color, 0.50),
      textColor,
      extendedProps: { upEvent: ev, isExam: ev.isExam, color, isSubjectEvent: !!subj, isRecurring },
    };

    if (!ev.recurrenceRule) {
      result.push({ ...base, start: ev.startTime, end: ev.endTime });
      continue;
    }

    try {
      const dtstart = new Date(ev.startTime);
      const duration = new Date(ev.endTime).getTime() - dtstart.getTime();
      const rule = RRule.fromString(`DTSTART:${dtstart.toISOString().replace(/[-:]/g,'').split('.')[0]}Z\nRRULE:${ev.recurrenceRule}`);
      const to = ev.recurrenceEndDate ? new Date(ev.recurrenceEndDate) : RANGE_FUTURE;
      const occurrences = rule.between(dtstart, to, true);
      for (const occ of occurrences) {
        result.push({
          ...base,
          id: `${ev.id}_${occ.getTime()}`,
          start: occ.toISOString(),
          end: new Date(occ.getTime() + duration).toISOString(),
          extendedProps: { ...base.extendedProps, originalId: ev.id },
        });
      }
    } catch {
      result.push({ ...base, start: ev.startTime, end: ev.endTime });
    }
  }

  for (const t of (tasks ?? [])) {
    if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') continue;
    const taskSubj = t.subjectId ? subjectById[t.subjectId] : null;
    const taskColor = taskSubj?.color ?? T.warn;
    result.push({
      id: `task_${t.id}`,
      title: t.title,
      start: t.dueDate.includes('T') ? t.dueDate.split('T')[0] : t.dueDate,
      allDay: true,
      backgroundColor: withAlpha(taskColor, 0.22),
      borderColor: taskColor,
      textColor: taskColor.startsWith('#') && taskColor.length === 7 ? darkenHex(taskColor) : T.inkSoft,
      extendedProps: { isTaskDue: true, color: taskColor },
    });
  }

  return result;
}

// ─── Helpers de renderizado ────────────────────────────────────────────────────

const DAY_NAMES = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function eventsForDay(fcEvents: EventInput[], day: Date): EventInput[] {
  const dayStr = localDateStr(day.toISOString());
  return fcEvents.filter(ev => {
    if (!ev.start) return false;
    const s = localDateStr(ev.start as string);
    if (s === dayStr) return true;
    if (ev.end) {
      const e = localDateStr(ev.end as string);
      if (s < dayStr && e > dayStr) return true;
    }
    return false;
  }).sort((a, b) => {
    const allA = /^\d{4}-\d{2}-\d{2}$/.test(a.start as string);
    const allB = /^\d{4}-\d{2}-\d{2}$/.test(b.start as string);
    if (allA && !allB) return -1;
    if (!allA && allB) return 1;
    return new Date(a.start as string).getTime() - new Date(b.start as string).getTime();
  });
}

function dotsForDay(fcEvents: EventInput[], day: Date): string[] {
  return eventsForDay(fcEvents, day).map(ev => {
    const p = ev.extendedProps as { color?: string; isTaskDue?: boolean };
    return p.isTaskDue ? T.warn : (p.color ?? T.accent);
  });
}

const NAV_BTN: React.CSSProperties = {
  width: 32, height: 32, borderRadius: T.rFull, flexShrink: 0,
  background: T.surfaceAlt, border: `1px solid ${T.line}`,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: T.ink,
};

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 16l-6-6 6-6"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4l6 6-6 6"/>
    </svg>
  );
}

// ─── Vista agenda mobile ───────────────────────────────────────────────────────

interface MobileAgendaProps {
  fcEvents: EventInput[];
  events: UPEvent[];
  onEventClick: (ev: UPEvent) => void;
  weekStart: Date;
  onWeekChange: (d: Date) => void;
}

function MobileAgenda({ fcEvents, events, onEventClick, weekStart, onWeekChange }: MobileAgendaProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const todayStr = localDateStr(new Date().toISOString());

  const fmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });
  const title = `${fmt.format(weekStart)} – ${fmt.format(weekEnd)} ${weekEnd.getFullYear()}`;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', background: T.surface,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <button style={NAV_BTN} onClick={() => onWeekChange(addDays(weekStart, -7))}>
          <ChevronLeft />
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontFamily: T.fontDisplay, fontSize: 17, color: T.ink }}>
          {title}
        </span>
        <button style={NAV_BTN} onClick={() => onWeekChange(addDays(weekStart, 7))}>
          <ChevronRight />
        </button>
      </div>

      {days.map((day, i) => {
        const dayStr = localDateStr(day.toISOString());
        const isToday = dayStr === todayStr;
        const dayEvents = eventsForDay(fcEvents, day);
        const dayLabel = `${day.getDate()} ${MONTHS_ES[day.getMonth()].toUpperCase()}`;

        return (
          <div key={dayStr}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '6px 12px',
              background: isToday ? T.accentSoft : T.surfaceAlt,
              borderBottom: `1px solid ${T.line}`,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
                textTransform: 'uppercase', fontFamily: T.fontUI,
                color: isToday ? T.accentInk : T.inkSoft,
              }}>
                {DAY_NAMES[i]}
              </span>
              <span style={{
                fontSize: 11, fontFamily: T.fontUI,
                color: isToday ? T.accentInk : T.inkMuted,
                fontWeight: isToday ? 600 : 400,
              }}>
                {dayLabel}
              </span>
            </div>

            {dayEvents.length === 0 ? (
              <div style={{ padding: '9px 12px', borderBottom: `1px solid ${T.lineSoft}`, background: T.surface }}>
                <span style={{ fontSize: 12, fontFamily: T.fontUI, color: T.inkMuted, fontStyle: 'italic' }}>
                  Sin eventos
                </span>
              </div>
            ) : (
              dayEvents.map((ev, j) => {
                const props = ev.extendedProps as {
                  color?: string; isExam?: boolean; isTaskDue?: boolean;
                  isSubjectEvent?: boolean; isRecurring?: boolean; originalId?: string;
                };
                const c = props.isTaskDue ? T.warn : (props.color ?? T.accent);
                const isAllDay = /^\d{4}-\d{2}-\d{2}$/.test(ev.start as string);
                const startTime = fmtTime(ev.start as string);
                const endTime = ev.end ? fmtTime(ev.end as string) : '';
                const timeStr = isAllDay ? 'Todo el día' : (endTime ? `${startTime} – ${endTime}` : startTime);

                const handleClick = () => {
                  if (props.isTaskDue) return;
                  const originalId = props.originalId ?? (ev.id as string);
                  const found = events.find(e => e.id === originalId);
                  if (found) onEventClick(found);
                };

                return (
                  <div key={j} onClick={handleClick} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderBottom: `1px solid ${T.lineSoft}`,
                    cursor: props.isTaskDue ? 'default' : 'pointer', background: T.surface,
                  }}>
                    <span style={{
                      fontSize: 12, fontFamily: T.fontUI, color: T.inkMuted,
                      minWidth: 84, flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      {timeStr}
                    </span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: c }} />
                    <span style={{
                      fontSize: 13, fontFamily: T.fontUI, color: T.ink,
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {props.isTaskDue ? '⏰ ' : props.isExam ? '✎ ' : props.isRecurring ? '↺ ' : ''}
                      {ev.title as string}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Vista de mes mobile ───────────────────────────────────────────────────────

interface MobileMonthViewProps {
  fcEvents: EventInput[];
  selectedWeekStart: Date;
  onDaySelect: (day: Date) => void;
}

function MobileMonthView({ fcEvents, selectedWeekStart, onDaySelect }: MobileMonthViewProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const todayStr = localDateStr(new Date().toISOString());
  const selectedWeekEnd = addDays(selectedWeekStart, 6);

  const gridStart = getMondayOf(viewMonth);
  const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
  const gridEnd = addDays(getMondayOf(lastDay), 6);
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
  const cells = Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i));

  const monthTitle = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(viewMonth);

  const prevMonth = () => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() - 1);
    setViewMonth(d);
  };
  const nextMonth = () => {
    const d = new Date(viewMonth);
    d.setMonth(d.getMonth() + 1);
    setViewMonth(d);
  };

  return (
    <div>
      {/* Toolbar de navegación de mes */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px', background: T.surface,
        borderBottom: `1px solid ${T.line}`,
      }}>
        <button style={NAV_BTN} onClick={prevMonth}><ChevronLeft /></button>
        <span style={{
          flex: 1, textAlign: 'center',
          fontFamily: T.fontDisplay, fontSize: 17, color: T.ink,
          textTransform: 'capitalize',
        }}>
          {monthTitle}
        </span>
        <button style={NAV_BTN} onClick={nextMonth}><ChevronRight /></button>
      </div>

      {/* Cabecera de días de la semana */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        background: T.surfaceAlt, borderBottom: `1px solid ${T.line}`,
        padding: '6px 4px 4px',
      }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
            fontFamily: T.fontUI, color: T.inkMuted, textTransform: 'uppercase',
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid de días */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
        background: T.surface, padding: '2px 4px 8px',
      }}>
        {cells.map((day) => {
          const dayStr = localDateStr(day.toISOString());
          const isToday = dayStr === todayStr;
          const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
          const isInSelectedWeek = day >= selectedWeekStart && day <= selectedWeekEnd;
          const dots = dotsForDay(fcEvents, day);

          return (
            <div
              key={dayStr}
              onClick={() => onDaySelect(day)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '4px 2px', cursor: 'pointer', minHeight: 44,
                background: isInSelectedWeek ? T.accentSoft : 'transparent',
                borderRadius: 4,
              }}
            >
              {/* Número del día */}
              <div style={{
                width: 26, height: 26, borderRadius: T.rFull,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isToday ? T.accent : 'transparent',
                color: isToday ? '#FBFAF5' : T.ink,
                fontSize: 13, fontFamily: T.fontUI,
                fontWeight: isToday ? 600 : 400,
                opacity: isCurrentMonth ? 1 : 0.3,
              }}>
                {day.getDate()}
              </div>

              {/* Dots de eventos */}
              <div style={{ display: 'flex', gap: 2, marginTop: 2, height: 7, alignItems: 'center' }}>
                {dots.length > 0 && dots.slice(0, 3).map((color, k) =>
                  k === 2 && dots.length > 3
                    ? <span key={k} style={{ fontSize: 7, color: T.inkMuted, lineHeight: '7px', fontFamily: T.fontUI }}>+{dots.length - 2}</span>
                    : <span key={k} style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Página Calendario ─────────────────────────────────────────────────────────

export function Calendar() {
  const calRef = useRef<FullCalendar>(null);
  const { mobile } = useResponsive();
  const { data: subjects = [] } = useSubjects();
  const { data: events   = [] } = useEvents();
  const { data: tasks    = [] } = useTasks();
  const addEvent    = useAddEvent();
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();

  const [modal, setModal] = useState<{
    mode: 'create' | 'edit';
    event?: UPEvent;
    defaultStart?: string;
    defaultEnd?: string;
  } | null>(null);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [onlyTasks,  setOnlyTasks]  = useState(false);
  const [mobileView, setMobileView] = useState<'agenda' | 'day' | 'month'>('agenda');
  const [weekStart,  setWeekStart]  = useState(() => getMondayOf(new Date()));

  const activeSubjects = subjects.filter(s => s.isActive);
  const allFcEvents = expandToFC(events, tasks, subjects);
  const fcEvents = onlyTasks
    ? allFcEvents.filter(e => (e.extendedProps as { isTaskDue?: boolean }).isTaskDue)
    : allFcEvents;
  const isSaving = addEvent.isPending || updateEvent.isPending;

  const handleDateSelect = (sel: DateSelectArg) => {
    setSaveError(null);
    setModal({ mode: 'create', defaultStart: sel.startStr, defaultEnd: sel.endStr });
    calRef.current?.getApi().unselect();
  };

  const handleEventClick = (info: EventClickArg) => {
    const { isTaskDue } = info.event.extendedProps as { upEvent?: UPEvent; isTaskDue?: boolean };
    if (isTaskDue) return;
    const originalId = info.event.extendedProps.originalId ?? info.event.id;
    const found = events.find(e => e.id === originalId);
    if (found) {
      setSaveError(null);
      setModal({ mode: 'edit', event: found });
    }
  };

  const handleSave = (data: Omit<UPEvent, 'id' | 'updatedAt'>) => {
    setSaveError(null);
    if (modal?.mode === 'edit' && modal.event) {
      updateEvent.mutate({ id: modal.event.id, changes: data }, {
        onSuccess: () => setModal(null),
        onError:   () => setSaveError('No se pudo guardar el evento. Intentá de nuevo.'),
      });
    } else {
      addEvent.mutate(data, {
        onSuccess: () => setModal(null),
        onError:   () => setSaveError('No se pudo crear el evento. Intentá de nuevo.'),
      });
    }
  };

  const handleDelete = () => {
    if (modal?.event) {
      deleteEvent.mutate(modal.event.id);
      setModal(null);
    }
  };

  const handleMonthDaySelect = (day: Date) => {
    setWeekStart(getMondayOf(day));
    setMobileView('agenda');
  };

  return (
    <div style={{ padding: mobile ? 12 : 24, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16, gap: 12, flexWrap: 'wrap', rowGap: 8,
      }}>
        <SectionTitle size={mobile ? 'md' : 'lg'}>Agenda</SectionTitle>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', rowGap: 6 }}>

          {/* Leyenda — solo en desktop */}
          {!onlyTasks && !mobile && (
            <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: T.fontUI, color: T.inkSoft, alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: T.danger, display: 'inline-block' }} />
                Examen
              </span>
              {subjects.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ display: 'flex', gap: 2 }}>
                    {subjects.slice(0, 4).map(s => (
                      <span key={s.id} style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: 'inline-block' }} />
                    ))}
                  </span>
                  ↺ Clase
                </span>
              )}
              {subjects.length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 10, height: 10, borderRadius: 2,
                    background: 'transparent', border: `2px solid ${T.inkMuted}`,
                    display: 'inline-block',
                  }} />
                  Evento de materia
                </span>
              )}
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: T.accent, display: 'inline-block' }} />
                Evento general
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: T.warn + '88', display: 'inline-block' }} />
                Vence tarea
              </span>
            </div>
          )}

          {/* Toggle: solo vencimientos */}
          <button onClick={() => setOnlyTasks(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: T.rFull, cursor: 'pointer',
            background: onlyTasks ? T.warnSoft : T.surfaceAlt,
            border: `1px solid ${onlyTasks ? T.warn + 'AA' : T.line}`,
            color: onlyTasks ? T.ink : T.inkSoft,
            fontSize: 12, fontFamily: T.fontUI, fontWeight: onlyTasks ? 600 : 400,
            transition: 'all 150ms',
          }}>
            <span style={{
              width: 10, height: 10, borderRadius: 3, flexShrink: 0,
              background: onlyTasks ? T.warn : T.warn + '88', display: 'inline-block',
            }} />
            Solo vencimientos
          </button>

          {!mobile && (
            <Button variant="primary" size="sm" icon="plus" onClick={() => { setSaveError(null); setModal({ mode: 'create' }); }}>
              Nuevo evento
            </Button>
          )}
        </div>
      </div>

      {/* Toggle Lista / Día / Mes — solo en mobile */}
      {mobile && (
        <div style={{
          display: 'inline-flex', marginBottom: 12,
          background: T.surfaceAlt, padding: 3, borderRadius: T.rFull,
        }}>
          {(['agenda', 'day', 'month'] as const).map(v => (
            <button key={v} onClick={() => setMobileView(v)} style={{
              padding: '6px 16px', borderRadius: T.rFull, border: 'none',
              background: mobileView === v ? T.accent : 'transparent',
              color: mobileView === v ? '#FBFAF5' : T.inkSoft,
              fontSize: 13, fontFamily: T.fontUI,
              fontWeight: mobileView === v ? 600 : 400,
              cursor: 'pointer', transition: 'all 150ms',
            }}>
              {v === 'agenda' ? 'Lista' : v === 'day' ? 'Día' : 'Mes'}
            </button>
          ))}
        </div>
      )}

      <div style={{
        background: T.surface, borderRadius: T.r3,
        border: `1px solid ${T.line}`, overflow: 'hidden',
        boxShadow: T.shadowSm,
      }}>
        {mobile && mobileView === 'agenda' ? (
          <MobileAgenda
            fcEvents={fcEvents}
            events={events}
            onEventClick={(ev) => { setSaveError(null); setModal({ mode: 'edit', event: ev }); }}
            weekStart={weekStart}
            onWeekChange={setWeekStart}
          />
        ) : mobile && mobileView === 'month' ? (
          <MobileMonthView
            fcEvents={fcEvents}
            selectedWeekStart={weekStart}
            onDaySelect={handleMonthDaySelect}
          />
        ) : (
          <>
            <style>{`
              .fc { font-family: ${T.fontUI}; }
              .fc .fc-button { background: ${T.surface}; border-color: ${T.line}; color: ${T.ink}; font-family: ${T.fontUI}; font-size: 13px; border-radius: ${T.rFull}px; padding: 6px 14px; }
              .fc .fc-button:hover { background: ${T.bgAlt}; }
              .fc .fc-button-primary:not(:disabled).fc-button-active,
              .fc .fc-button-primary:not(:disabled):active { background: ${T.accent}; border-color: ${T.accent}; color: #FBFAF5; }
              .fc .fc-toolbar-title { font-family: ${T.fontDisplay}; font-weight: 400; font-size: 22px; letter-spacing: -0.3px; }
              .fc .fc-col-header-cell { background: ${T.surfaceAlt}; font-size: 11px; letter-spacing: 0.8px; text-transform: uppercase; font-weight: 600; color: ${T.inkMuted}; }
              .fc .fc-daygrid-day.fc-day-today { background: ${T.accentSoft}; }
              .fc .fc-timegrid-col.fc-day-today { background: ${T.accentSoft}33; }
              .fc .fc-event { border-radius: 6px; font-size: 12px; font-weight: 500; padding: 0; cursor: pointer; }
              .fc .fc-daygrid-event-dot { display: none; }
              .fc-theme-standard td, .fc-theme-standard th { border-color: ${T.line}; }
              .fc-theme-standard .fc-scrollgrid { border-color: ${T.line}; }
              .fc .fc-highlight { background: ${T.accentSoft}; }
              .fc .fc-toolbar { padding: 16px 20px; }
              .fc .fc-view-harness { padding: 0; }
              .fc a.fc-daygrid-day-number, .fc a.fc-col-header-cell-cushion { cursor: pointer; }
              .fc .fc-daygrid-more-link { font-size: 11px; font-family: ${T.fontUI}; color: ${T.inkSoft}; }
              @media (max-width: 767px) {
                .fc .fc-toolbar-title { font-size: 17px; letter-spacing: -0.2px; }
                .fc .fc-toolbar { padding: 10px 12px; }
                .fc .fc-button { padding: 5px 8px; font-size: 12px; min-height: 36px; }
              }
            `}</style>

            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
              initialView={mobile ? 'timeGridDay' : 'dayGridMonth'}
              locale="es"
              buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día', list: 'Lista' }}
              headerToolbar={mobile
                ? { left: 'prev,next', center: 'title', right: '' }
                : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }
              }
              events={fcEvents}
              eventContent={(arg) => {
                const props = arg.event.extendedProps as {
                  color?: string; isExam?: boolean; isTaskDue?: boolean;
                  isSubjectEvent?: boolean; isRecurring?: boolean;
                };

                if (props.isTaskDue) {
                  const tc = (props.color as string | undefined) ?? T.warn;
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      background: withAlpha(tc, 0.22), borderRadius: 4, overflow: 'hidden',
                      borderLeft: `2px solid ${tc}`,
                      padding: '2px 5px', width: '100%', minWidth: 0,
                      height: '100%', boxSizing: 'border-box',
                      color: tc.startsWith('#') && tc.length === 7 ? darkenHex(tc) : T.inkSoft, fontSize: 11,
                    }}>
                      <span style={{ flexShrink: 0, fontSize: 9 }}>⏰</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {arg.event.title}
                      </span>
                    </div>
                  );
                }

                if (!props.color) return true;

                const c = props.color;
                const timeSpan = arg.timeText
                  ? <span style={{ opacity: 0.82, flexShrink: 0, fontSize: 11 }}>{arg.timeText}</span>
                  : null;
                const titleSpan = (
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {arg.event.title}
                  </span>
                );

                if (props.isExam || (props.isSubjectEvent && props.isRecurring)) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 4,
                      background: c, borderRadius: 5, overflow: 'hidden',
                      padding: '3px 6px', width: '100%', minWidth: 0,
                      height: '100%', boxSizing: 'border-box',
                      color: c.startsWith('#') && c.length === 7 ? darkenHex(c) : '#fff', fontSize: 12, fontWeight: 500,
                    }}>
                      {props.isRecurring && <span style={{ flexShrink: 0, fontSize: 10, opacity: 0.75, paddingTop: 1 }}>↺</span>}
                      {props.isExam && <span style={{ flexShrink: 0, fontSize: 10, opacity: 0.75, paddingTop: 1 }}>✎</span>}
                      {timeSpan}
                      {titleSpan}
                    </div>
                  );
                }

                if (props.isSubjectEvent && !props.isRecurring) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'flex-start', gap: 4,
                      background: withAlpha(c, 0.16), borderRadius: 5, overflow: 'hidden',
                      borderLeft: `3px solid ${c}`, borderTop: `1px solid ${withAlpha(c, 0.27)}`,
                      borderRight: `1px solid ${withAlpha(c, 0.27)}`, borderBottom: `1px solid ${withAlpha(c, 0.27)}`,
                      padding: '3px 6px', width: '100%', minWidth: 0,
                      height: '100%', boxSizing: 'border-box',
                      color: c.startsWith('#') && c.length === 7 ? darkenHex(c) : T.inkSoft, fontSize: 12, fontWeight: 600,
                    }}>
                      {timeSpan}
                      {titleSpan}
                      {props.isExam && <span style={{ flexShrink: 0, fontSize: 11 }}>✎</span>}
                    </div>
                  );
                }

                return (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 4,
                    background: withAlpha(c, 0.16), borderRadius: 5, overflow: 'hidden',
                    borderLeft: `3px solid ${c}`,
                    padding: '3px 6px', width: '100%', minWidth: 0,
                    height: '100%', boxSizing: 'border-box',
                    color: c.startsWith('#') && c.length === 7 ? darkenHex(c) : T.inkSoft, fontSize: 12, fontWeight: 600,
                  }}>
                    {timeSpan}
                    {titleSpan}
                    {props.isExam && <span style={{ flexShrink: 0, fontSize: 11 }}>✎</span>}
                  </div>
                );
              }}
              selectable
              selectMirror
              navLinks
              select={handleDateSelect}
              eventClick={handleEventClick}
              height="auto"
              firstDay={1}
              nowIndicator
              eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              slotMinTime="06:00:00"
              slotMaxTime="23:00:00"
            />
          </>
        )}
      </div>

      {events.length === 0 && (
        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 13, fontFamily: T.fontUI, color: T.inkMuted,
        }}>
          Aún no hay eventos. {mobile ? 'Tocá el botón + para empezar.' : 'Hacé clic en un día o en "Nuevo evento" para empezar.'}
        </p>
      )}

      {mobile && createPortal(
        <button
          onClick={() => { setSaveError(null); setModal({ mode: 'create' }); }}
          aria-label="Nuevo evento"
          style={{
            position: 'fixed', bottom: 76, right: 20,
            width: 52, height: 52, borderRadius: T.rFull,
            background: T.accent, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: T.shadowLg, zIndex: 100,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none"
            stroke="#FBFAF5" strokeWidth="2" strokeLinecap="round">
            <path d="M10 4v12M4 10h12"/>
          </svg>
        </button>,
        document.body
      )}

      {modal && (
        <EventModal
          event={modal.event}
          defaultStart={modal.defaultStart}
          defaultEnd={modal.defaultEnd}
          subjects={activeSubjects}
          isSaving={isSaving}
          saveError={saveError}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal(null)}
          mobile={mobile}
        />
      )}
    </div>
  );
}
