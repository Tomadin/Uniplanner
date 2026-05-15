import { useState } from 'react';
import { RRule } from 'rrule';
import { useAuthStore } from '../auth/authStore';
import { T, PRIORITY_META } from '../design/tokens';
import { Card, SectionTitle, EmptyState } from '../components/ui/Misc';
import { Checkbox } from '../components/ui/Button';
import { PriorityChip, SubjectChip } from '../components/ui/Chips';
import { Icon } from '../components/ui/Icon';
import { useSubjects } from '../hooks/useSubjects';
import { useTasks, useToggleTask } from '../hooks/useTasks';
import { useQuickNotes, useAddQuickNote, useDeleteQuickNote } from '../hooks/useQuickNotes';
import { useEvents } from '../hooks/useEvents';
import { relativeLabel, daysBetween, formatDate } from '../utils/date';
import type { Task, Subject, Event as UPEvent } from '../types';

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAY_NAMES   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Expande eventos (incluyendo recurrentes) que caen en `date`. */
function eventsForDate(events: UPEvent[], date: Date): UPEvent[] {
  const dateStr = date.toDateString();
  const result: UPEvent[] = [];

  for (const ev of events) {
    if (!ev.recurrenceRule) {
      if (new Date(ev.startTime).toDateString() === dateStr) result.push(ev);
      continue;
    }
    try {
      const dtstart = new Date(ev.startTime);
      const rule = RRule.fromString(
        `DTSTART:${dtstart.toISOString().replace(/[-:]/g,'').split('.')[0]}Z\nRRULE:${ev.recurrenceRule}`
      );
      const dayStart = new Date(date); dayStart.setHours(0,0,0,0);
      const dayEnd   = new Date(date); dayEnd.setHours(23,59,59,999);
      const hits = rule.between(dayStart, dayEnd, true);
      if (hits.length > 0) result.push(ev);
    } catch { /* ignorar RRULE inválida */ }
  }
  return result.sort((a,b) => new Date(a.startTime).getHours() - new Date(b.startTime).getHours());
}

// ─── Tarjetas de estadísticas ─────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, danger }: {
  label: string; value: number; sub: string; accent?: boolean; danger?: boolean;
}) {
  return (
    <Card padding={16} style={{
      background: accent ? T.accentSoft : danger ? T.dangerSoft : T.surface,
      border: `1px solid ${accent ? T.accentDim + '55' : danger ? T.danger + '33' : T.line}`,
    }}>
      <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', fontWeight: 600,
        color: danger ? T.danger : accent ? T.accentInk : T.inkMuted, fontFamily: T.fontUI }}>
        {label}
      </div>
      <div style={{ fontFamily: T.fontDisplay, fontSize: 40, lineHeight: 1,
        color: danger ? T.danger : accent ? T.accentInk : T.ink, marginTop: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, fontFamily: T.fontUI }}>{sub}</div>
    </Card>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
      <SectionTitle size="md">{title}</SectionTitle>
      {action && (
        <button onClick={onAction} style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: T.accentInk, fontSize: 13, fontWeight: 500, fontFamily: T.fontUI, padding: 0,
        }}>{action} →</button>
      )}
    </div>
  );
}

// ─── Fila de tarea próxima ────────────────────────────────────────────────────

function TaskRow({ task, subject, now }: { task: Task; subject?: Subject; now: Date }) {
  const toggle = useToggleTask();
  const diff   = task.dueDate ? daysBetween(task.dueDate, now) : null;
  const isOver = diff !== null && diff < 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: `1px dashed ${T.lineSoft}`,
    }}>
      <Checkbox checked={task.status === 'COMPLETED'} onChange={() => toggle.mutate(task)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.ink, fontFamily: T.fontUI, fontWeight: 500, marginBottom: 2,
          textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{task.title}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SubjectChip subject={subject} compact />
          {task.dueDate && (
            <span style={{ fontSize: 11, fontFamily: T.fontUI,
              color: isOver ? T.danger : T.inkSoft, fontWeight: isOver ? 600 : 400 }}>
              {relativeLabel(task.dueDate, now)}
            </span>
          )}
        </div>
      </div>
      <PriorityChip value={task.priority} compact />
    </div>
  );
}

// ─── Fila de evento de hoy ────────────────────────────────────────────────────

function TodayEventRow({ event, subject }: { event: UPEvent; subject?: Subject }) {
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 64, fontFamily: T.fontMono, fontSize: 13, color: T.inkSoft, paddingTop: 2 }}>
        {formatDate(event.startTime, { timeOnly: true })}
        <span style={{ opacity: 0.5 }}>–{formatDate(event.endTime, { timeOnly: true })}</span>
      </div>
      <div style={{ width: 3, alignSelf: 'stretch', minHeight: 36, borderRadius: 2,
        background: subject?.color ?? T.accent }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, color: T.ink, fontFamily: T.fontUI, fontWeight: 500,
          display: 'flex', alignItems: 'center', gap: 8 }}>
          {event.title}
          {event.isExam && (
            <span style={{ fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
              background: T.danger, color: '#fff', padding: '2px 7px',
              borderRadius: T.rFull, fontWeight: 600 }}>examen</span>
          )}
        </div>
        {subject && (
          <div style={{ fontSize: 12, color: T.inkSoft, marginTop: 2, fontFamily: T.fontUI }}>{subject.name}</div>
        )}
      </div>
    </div>
  );
}

// ─── Fila de examen próximo ───────────────────────────────────────────────────

function ExamRow({ event, subject, now }: { event: UPEvent; subject?: Subject; now: Date }) {
  const diff = daysBetween(event.startTime, now);
  const mon  = MONTH_NAMES[new Date(event.startTime).getMonth()].slice(0,3);
  const day  = new Date(event.startTime).getDate();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
        width: 52, height: 52, borderRadius: T.r2,
        background: T.surface, border: `1px solid ${T.accentDim}77`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <div style={{ fontSize: 9, fontFamily: T.fontUI, color: T.accentInk,
          textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>{mon}</div>
        <div style={{ fontSize: 22, fontFamily: T.fontDisplay, color: T.accentInk, lineHeight: 1 }}>{day}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, fontFamily: T.fontUI }}>
          {subject?.name ?? '—'}
        </div>
        <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.fontUI, marginTop: 2 }}>
          {event.title} · {formatDate(event.startTime, { timeOnly: true })}
        </div>
      </div>
      <div style={{ fontSize: 11, fontFamily: T.fontUI,
        color: diff <= 3 ? T.danger : T.inkSoft, fontWeight: 600, textAlign: 'right' }}>
        {diff === 0 ? 'HOY' : `en ${diff}d`}
      </div>
    </div>
  );
}

// ─── Notas rápidas ────────────────────────────────────────────────────────────

function QuickNoteInput() {
  const [text, setText] = useState('');
  const add = useAddQuickNote();
  const submit = () => { if (text.trim()) { add.mutate(text.trim()); setText(''); } };
  return (
    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
      <input value={text} onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="Anotá algo rápido…"
        style={{
          flex: 1, padding: '8px 14px', fontSize: 13,
          background: T.surface, border: `1px solid ${T.line}`,
          borderRadius: T.rFull, outline: 'none', fontFamily: T.fontUI, color: T.ink,
        }}
      />
      <button onClick={submit} style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: T.accentSoft, color: T.accentInk, border: 'none',
        borderRadius: T.rFull, cursor: 'pointer',
      }}><Icon name="plus" size={16} /></button>
    </div>
  );
}

function NoteRow({ text, onDelete }: { text: string; onDelete: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ padding: '8px 0', position: 'relative', borderBottom: `1px dashed ${T.lineSoft}` }}>
      <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.7,
        fontFamily: T.fontDisplay, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>{text}</div>
      {hover && (
        <button onClick={onDelete} style={{
          position: 'absolute', top: 4, right: 0, border: 'none',
          background: 'transparent', cursor: 'pointer', color: T.inkMuted, padding: 4,
        }}><Icon name="x" size={14} /></button>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function Dashboard({ onNavigate }: { onNavigate: (r: string) => void }) {
  const now = new Date();
  const { user }              = useAuthStore();
  const { data: subjects = [] } = useSubjects();
  const { data: tasks    = [] } = useTasks();
  const { data: notes    = [] } = useQuickNotes();
  const { data: events   = [] } = useEvents();
  const deleteNote              = useDeleteQuickNote();

  const firstName    = user?.name?.split(' ')[0] ?? 'estudiante';
  const subjectById  = Object.fromEntries(subjects.map(s => [s.id, s]));

  // Próximas tareas (7 días)
  const upcoming = tasks
    .filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate)
    .filter(t => { const d = daysBetween(t.dueDate!, now); return d >= 0 && d <= 7; })
    .sort((a,b) => PRIORITY_META[b.priority].order - PRIORITY_META[a.priority].order)
    .slice(0, 5);

  const overdue    = tasks.filter(t => t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && t.dueDate && daysBetween(t.dueDate, now) < 0);
  const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS');
  const completed  = tasks.filter(t => t.status === 'COMPLETED');

  // Próximos exámenes (30 días)
  const upcomingExams = events
    .filter(e => e.isExam)
    .filter(e => { const d = daysBetween(e.startTime, now); return d >= 0 && d <= 30; })
    .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 4);

  // Eventos de hoy
  const todayEvents = eventsForDate(events, now);

  return (
    <div style={{ padding: 32, maxWidth: 1240, margin: '0 auto' }}>

      {/* ── Hero ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
          color: T.inkMuted, fontFamily: T.fontUI, marginBottom: 6 }}>
          {DAY_NAMES[now.getDay()]} · {now.getDate()} de {MONTH_NAMES[now.getMonth()]}
        </div>
        <SectionTitle size="xl" style={{ marginBottom: 4 }}>
          Buenos días, <em>{firstName}</em>.
        </SectionTitle>
        <div style={{ fontSize: 15, color: T.inkSoft, fontFamily: T.fontUI }}>
          Tenés{' '}
          <strong style={{ color: T.ink }}>{upcoming.length} tarea{upcoming.length !== 1 ? 's' : ''}</strong>
          {' '}en los próximos 7 días
          {overdue.length > 0 && (
            <> y{' '}
              <strong style={{ color: T.danger }}>{overdue.length} vencida{overdue.length > 1 ? 's' : ''}</strong>
            </>
          )}.
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 28 }}>
        <StatCard label="En curso"          value={inProgress.length}   sub="tareas activas" />
        <StatCard label="Completadas"        value={completed.length}    sub="buen trabajo ✦" accent />
        <StatCard label="Próx. exámenes"     value={upcomingExams.length} sub="en 30 días" />
        <StatCard label="Vencidas"           value={overdue.length}      sub={overdue.length ? 'requieren atención' : 'todo al día'} danger={overdue.length > 0} />
      </div>

      {/* ── Grilla principal ── */}
      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: '1.3fr 1fr' }}>

        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Próximas tareas */}
          <Card padding={24}>
            <SectionHeader title="Próximas tareas" action="Ver todas" onAction={() => onNavigate('tasks-table')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {upcoming.length === 0
                ? <EmptyState text="No hay tareas próximas. ¡Respirá!" />
                : upcoming.map(t => <TaskRow key={t.id} task={t} subject={subjectById[t.subjectId ?? '']} now={now} />)
              }
            </div>
          </Card>

          {/* Agenda de hoy */}
          <Card padding={24}>
            <SectionHeader title="Agenda de hoy" action="Calendario" onAction={() => onNavigate('calendar')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {todayEvents.length === 0
                ? <EmptyState text="Día libre. Un buen momento para adelantar." />
                : todayEvents.map(e => <TodayEventRow key={e.id} event={e} subject={subjectById[e.subjectId ?? '']} />)
              }
            </div>
          </Card>
        </div>

        {/* Columna derecha */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Próximos exámenes */}
          <Card padding={24} style={{ background: T.accentSoft, border: `1px solid ${T.accentDim}44` }}>
            <SectionHeader title="Próximos exámenes" action="Materias" onAction={() => onNavigate('subjects')} />
            {upcomingExams.length === 0
              ? <EmptyState text="Sin exámenes en los próximos 30 días. ✦" />
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {upcomingExams.map(e => <ExamRow key={e.id} event={e} subject={subjectById[e.subjectId ?? '']} now={now} />)}
                </div>
              )
            }
          </Card>

          {/* Notas rápidas */}
          <Card padding={24} style={{ background: T.surfaceAlt }}>
            <SectionHeader title="Notas rápidas" />
            <QuickNoteInput />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {notes.length === 0
                ? <EmptyState text="Sin notas aún." />
                : notes.slice(0, 4).map(n => <NoteRow key={n.id} text={n.content} onDelete={() => deleteNote.mutate(n.id)} />)
              }
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
