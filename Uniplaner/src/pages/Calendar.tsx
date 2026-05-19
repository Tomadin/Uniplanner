import { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, EventInput } from '@fullcalendar/core';
import { RRule } from 'rrule';
import { T } from '../design/tokens';
import { Button, Checkbox, IconButton } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/Misc';
import { useSubjects } from '../hooks/useSubjects';
import { useEvents, useAddEvent, useUpdateEvent, useDeleteEvent } from '../hooks/useEvents';
import { useTasks } from '../hooks/useTasks';
import type { Event as UPEvent, Subject } from '../types';

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
}

function EventModal({ event, defaultStart, defaultEnd, subjects, isSaving, saveError, onSave, onDelete, onClose }: EventModalProps) {
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
  const [confirmDel, setConfirmDel] = useState(false);

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
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.surface, borderRadius: T.r4, padding: 28,
        width: '100%', maxWidth: 480, boxShadow: T.shadowLg,
        border: `1px solid ${T.line}`,
        maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <SectionTitle size="md" style={{ flex: 1 }}>
            {event ? 'Editar evento' : 'Nuevo evento'}
          </SectionTitle>
          <IconButton icon="x" size={28} onClick={onClose} />
        </div>

        {/* UX-3: aviso cuando se edita un evento recurrente */}
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
          {/* Título */}
          <div>
            <label style={LABEL}>Título</label>
            <input style={INPUT} autoFocus value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Parcial de Anatomía" />
          </div>

          {/* Inicio / Fin */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Inicio</label>
              <input style={INPUT} type="datetime-local" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Fin</label>
              <input style={INPUT} type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>

          {/* Materia */}
          <div>
            <label style={LABEL}>Materia (opcional)</label>
            <select style={INPUT} value={subjId} onChange={e => setSubjId(e.target.value)}>
              <option value="">— General</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* UX-4: label sin jerga técnica */}
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

          {/* BUG-3: fecha de fin de repetición, solo visible cuando hay repetición */}
          {rrule && (
            <div>
              <label style={LABEL}>Repetir hasta (opcional)</label>
              <input style={INPUT} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          )}

          {/* UX-5: Checkbox del sistema de diseño, no nativo */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Checkbox checked={isExam} onChange={v => setIsExam(v)} />
            <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.inkSoft }}>
              Marcar como examen
            </span>
          </label>
        </div>

        {/* UX-2: feedback de error al guardar */}
        {saveError && (
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: T.r1,
            background: T.dangerSoft, fontSize: 12,
            fontFamily: T.fontUI, color: T.danger,
          }}>
            {saveError}
          </div>
        )}

        {/* UX-1: confirmación inline en lugar de window.confirm() */}
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
            {/* UX-2: botón con estado de carga */}
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
    const color = ev.isExam ? T.danger : (subj?.color ?? T.accent);
    const isRecurring = !!ev.recurrenceRule;
    // Clases recurrentes de materia y exámenes → fondo sólido; todo lo demás → tinte ghost
    const isSolid = ev.isExam || (!!subj && isRecurring);
    const base: EventInput = {
      id: ev.id,
      title: ev.title,
      backgroundColor: isSolid ? color : color + '28',
      borderColor:     isSolid ? color : color + '80',
      extendedProps: { upEvent: ev, isExam: ev.isExam, color, isSubjectEvent: !!subj, isRecurring },
    };

    if (!ev.recurrenceRule) {
      result.push({ ...base, start: ev.startTime, end: ev.endTime });
      continue;
    }

    // BUG-2: expandir desde dtstart (no desde "hoy") para mostrar ocurrencias pasadas
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
    result.push({
      id: `task_${t.id}`,
      title: t.title,
      start: t.dueDate,
      allDay: true,
      backgroundColor: T.warn + '44',
      borderColor: T.warn,
      extendedProps: { isTaskDue: true },
    });
  }

  return result;
}

// ─── Página Calendario ─────────────────────────────────────────────────────────

export function Calendar() {
  const calRef = useRef<FullCalendar>(null);
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

  // UX-2: no cerrar el modal en handleSave; cerrarlo solo en onSuccess
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

  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: '0 auto' }}>
      {/* UX-6: flexWrap para que la leyenda y el botón no se aprieten en pantallas intermedias */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, gap: 12, flexWrap: 'wrap', rowGap: 8,
      }}>
        <SectionTitle size="lg">Agenda</SectionTitle>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', rowGap: 6 }}>

          {/* Leyenda — se oculta en modo solo-vencimientos */}
          {!onlyTasks && (
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

          <Button variant="primary" size="sm" icon="plus" onClick={() => { setSaveError(null); setModal({ mode: 'create' }); }}>
            Nuevo evento
          </Button>
        </div>
      </div>

      <div style={{
        background: T.surface, borderRadius: T.r3,
        border: `1px solid ${T.line}`, overflow: 'hidden',
        boxShadow: T.shadowSm,
      }}>
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
        `}</style>

        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="es"
          buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
          headerToolbar={{
            left:   'prev,next today',
            center: 'title',
            right:  'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={fcEvents}
          eventContent={(arg) => {
            const props = arg.event.extendedProps as {
              color?: string; isExam?: boolean; isTaskDue?: boolean;
              isSubjectEvent?: boolean; isRecurring?: boolean;
            };

            // Vencimiento de tarea — chip compacto amarillo
            if (props.isTaskDue) {
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: T.warn + '44', borderRadius: 4, overflow: 'hidden',
                  borderLeft: `2px solid ${T.warn}`,
                  padding: '2px 5px', width: '100%', minWidth: 0,
                  height: '100%', boxSizing: 'border-box',
                  color: T.ink, fontSize: 11,
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

            // ① Clase recurrente de materia o examen — sólido con texto blanco
            if (props.isExam || (props.isSubjectEvent && props.isRecurring)) {
              return (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 4,
                  background: c, borderRadius: 5, overflow: 'hidden',
                  padding: '3px 6px', width: '100%', minWidth: 0,
                  height: '100%', boxSizing: 'border-box',
                  color: '#fff', fontSize: 12, fontWeight: 500,
                }}>
                  {props.isRecurring && <span style={{ flexShrink: 0, fontSize: 10, opacity: 0.75, paddingTop: 1 }}>↺</span>}
                  {props.isExam && <span style={{ flexShrink: 0, fontSize: 10, opacity: 0.75, paddingTop: 1 }}>✎</span>}
                  {timeSpan}
                  {titleSpan}
                </div>
              );
            }

            // ② Evento suelto de materia — ghost con borde izquierdo y tinte
            if (props.isSubjectEvent && !props.isRecurring) {
              return (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 4,
                  background: c + '28', borderRadius: 5, overflow: 'hidden',
                  borderLeft: `3px solid ${c}`, borderTop: `1px solid ${c}44`,
                  borderRight: `1px solid ${c}44`, borderBottom: `1px solid ${c}44`,
                  padding: '3px 6px', width: '100%', minWidth: 0,
                  height: '100%', boxSizing: 'border-box',
                  color: c, fontSize: 12, fontWeight: 600,
                }}>
                  {timeSpan}
                  {titleSpan}
                  {props.isExam && <span style={{ flexShrink: 0, fontSize: 11 }}>✎</span>}
                </div>
              );
            }

            // ③ Evento general sin materia — tinte del color + borde izquierdo
            return (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 4,
                background: c + '28', borderRadius: 5, overflow: 'hidden',
                borderLeft: `3px solid ${c}`,
                padding: '3px 6px', width: '100%', minWidth: 0,
                height: '100%', boxSizing: 'border-box',
                color: c, fontSize: 12, fontWeight: 600,
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
      </div>

      {/* M-1: guía cuando no hay eventos */}
      {events.length === 0 && (
        <p style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 13, fontFamily: T.fontUI, color: T.inkMuted,
        }}>
          Aún no hay eventos. Hacé clic en un día o en "Nuevo evento" para empezar.
        </p>
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
        />
      )}
    </div>
  );
}
