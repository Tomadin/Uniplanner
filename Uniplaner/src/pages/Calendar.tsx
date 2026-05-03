import { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, EventInput } from '@fullcalendar/core';
import { RRule } from 'rrule';
import { T } from '../design/tokens';
import { Button, IconButton } from '../components/ui/Button';
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
  onSave: (data: Omit<UPEvent, 'id' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function EventModal({ event, defaultStart, defaultEnd, subjects, onSave, onDelete, onClose }: EventModalProps) {
  const toLocal = (iso?: string) => iso ? new Date(iso).toISOString().slice(0, 16) : '';

  const [title,   setTitle]   = useState(event?.title ?? '');
  const [start,   setStart]   = useState(toLocal(event?.startTime ?? defaultStart));
  const [end,     setEnd]     = useState(toLocal(event?.endTime   ?? defaultEnd));
  const [subjId,  setSubjId]  = useState(event?.subjectId ?? '');
  const [isExam,  setIsExam]  = useState(event?.isExam ?? false);
  const [rrule,   setRrule]   = useState(event?.recurrenceRule ?? '');

  const valid = title.trim() && start && end;

  const submit = () => {
    if (!valid) return;
    onSave({
      title: title.trim(),
      startTime: new Date(start).toISOString(),
      endTime:   new Date(end).toISOString(),
      subjectId: subjId || null,
      isExam,
      recurrenceRule: rrule || null,
      recurrenceEndDate: null,
    });
  };

  const INPUT: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 14,
    fontFamily: T.fontUI, background: T.surfaceAlt,
    border: `1px solid ${T.line}`, borderRadius: T.r1,
    color: T.ink, outline: 'none',
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
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 20 }}>
          <SectionTitle size="md" style={{ flex: 1 }}>
            {event ? 'Editar evento' : 'Nuevo evento'}
          </SectionTitle>
          <IconButton icon="x" size={28} onClick={onClose} />
        </div>

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

          {/* Recurrencia */}
          <div>
            <label style={LABEL}>Recurrencia (RRULE, opcional)</label>
            <select style={INPUT} value={rrule} onChange={e => setRrule(e.target.value)}>
              <option value="">Sin recurrencia</option>
              <option value="FREQ=DAILY">Diario</option>
              <option value="FREQ=WEEKLY">Semanal (mismo día)</option>
              <option value="FREQ=WEEKLY;BYDAY=MO,WE,FR">Lunes, Miércoles, Viernes</option>
              <option value="FREQ=WEEKLY;BYDAY=TU,TH">Martes y Jueves</option>
              <option value="FREQ=MONTHLY">Mensual</option>
            </select>
          </div>

          {/* Es examen */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={isExam} onChange={e => setIsExam(e.target.checked)} />
            <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.inkSoft }}>
              Marcar como examen (badge especial en el calendario)
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          {onDelete && <Button variant="danger" size="sm" onClick={onDelete}>Eliminar</Button>}
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={submit}>
            {event ? 'Guardar cambios' : 'Crear evento'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Expansión de eventos recurrentes para FullCalendar ────────────────────────

function expandToFC(events: UPEvent[], tasks: ReturnType<typeof useTasks>['data'], subjects: Subject[]): EventInput[] {
  const subjectById = Object.fromEntries(subjects.map(s => [s.id, s]));
  const result: EventInput[] = [];

  for (const ev of events) {
    const subj = ev.subjectId ? subjectById[ev.subjectId] : null;
    const color = ev.isExam ? T.danger : (subj?.color ?? T.accent);
    const base: EventInput = {
      id: ev.id,
      title: ev.title,
      backgroundColor: color,
      borderColor: color,
      extendedProps: { upEvent: ev, isExam: ev.isExam },
    };

    if (!ev.recurrenceRule) {
      result.push({ ...base, start: ev.startTime, end: ev.endTime });
      continue;
    }

    // Expandir RRULE — mostrar hasta 1 año
    try {
      const dtstart = new Date(ev.startTime);
      const duration = new Date(ev.endTime).getTime() - dtstart.getTime();
      const rule = RRule.fromString(`DTSTART:${dtstart.toISOString().replace(/[-:]/g,'').split('.')[0]}Z\nRRULE:${ev.recurrenceRule}`);
      const occurrences = rule.between(new Date(), new Date(Date.now() + 365 * 24 * 3600 * 1000));
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

  // Tareas con fecha límite como indicadores de fondo
  for (const t of (tasks ?? [])) {
    if (!t.dueDate || t.status === 'COMPLETED' || t.status === 'CANCELLED') continue;
    result.push({
      id: `task_${t.id}`,
      title: `⏰ ${t.title}`,
      start: t.dueDate,
      allDay: true,
      display: 'background',
      backgroundColor: T.warn + '55',
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

  const fcEvents = expandToFC(events, tasks, subjects);

  const handleDateSelect = (sel: DateSelectArg) => {
    setModal({ mode: 'create', defaultStart: sel.startStr, defaultEnd: sel.endStr });
    calRef.current?.getApi().unselect();
  };

  const handleEventClick = (info: EventClickArg) => {
    const { isTaskDue } = info.event.extendedProps as { upEvent?: UPEvent; isTaskDue?: boolean };
    if (isTaskDue) return;
    const originalId = info.event.extendedProps.originalId ?? info.event.id;
    const found = events.find(e => e.id === originalId);
    if (found) setModal({ mode: 'edit', event: found });
  };

  const handleSave = (data: Omit<UPEvent, 'id' | 'updatedAt'>) => {
    if (modal?.mode === 'edit' && modal.event) {
      updateEvent.mutate({ id: modal.event.id, changes: data });
    } else {
      addEvent.mutate(data);
    }
    setModal(null);
  };

  const handleDelete = () => {
    if (modal?.event && confirm(`¿Eliminar "${modal.event.title}"?`)) {
      deleteEvent.mutate(modal.event.id);
      setModal(null);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
        <SectionTitle size="lg">Agenda</SectionTitle>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Leyenda */}
          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: T.fontUI, color: T.inkSoft, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: T.danger, display: 'inline-block' }} />
              Examen
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: T.accent, display: 'inline-block' }} />
              Evento
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: T.warn + '88', display: 'inline-block' }} />
              Vence tarea
            </span>
          </div>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setModal({ mode: 'create' })}>
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
          .fc .fc-event { border-radius: 6px; font-size: 12px; font-weight: 500; padding: 2px 4px; cursor: pointer; }
          .fc .fc-daygrid-event-dot { display: none; }
          .fc-theme-standard td, .fc-theme-standard th { border-color: ${T.line}; }
          .fc-theme-standard .fc-scrollgrid { border-color: ${T.line}; }
          .fc .fc-highlight { background: ${T.accentSoft}; }
          .fc .fc-toolbar { padding: 16px 20px; }
          .fc .fc-view-harness { padding: 0; }
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
          selectable
          selectMirror
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

      {modal && (
        <EventModal
          event={modal.event}
          defaultStart={modal.defaultStart}
          defaultEnd={modal.defaultEnd}
          subjects={subjects}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
