import { useState } from 'react';
import { T, STATUS_META, PRIORITY_CYCLE, STATUS_CYCLE } from '../design/tokens';
import type { TaskPriorityKey, TaskStatusKey } from '../design/tokens';
import { SectionTitle, EmptyState } from '../components/ui/Misc';
import { Button, Checkbox, IconButton } from '../components/ui/Button';
import { PriorityChip, StatusChip, SubjectChip } from '../components/ui/Chips';
import { useSubjects } from '../hooks/useSubjects';
import { useTasks, useAddTask, useToggleTask, useDeleteTask, useUpdateTask } from '../hooks/useTasks';
import { relativeLabel, daysBetween } from '../utils/date';
import type { Subject, Task } from '../types';

function InlineCycler<T extends string>({ value, cycle, render, onChange }: {
  value: T; cycle: T[]; render: (v: T) => React.ReactNode; onChange: (v: T) => void;
}) {
  const next = () => { const idx = cycle.indexOf(value); onChange(cycle[(idx + 1) % cycle.length]); };
  return <div onClick={next} style={{ cursor: 'pointer', display: 'inline-block' }} title="Clic para cambiar">{render(value)}</div>;
}

function AddTaskForm({ onDone, subjects }: { onDone: () => void; subjects: Subject[] }) {
  const [title,     setTitle]     = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
  const add = useAddTask();
  const submit = () => {
    if (!title.trim()) return;
    add.mutate({
      title: title.trim(), subjectId: subjectId || null, parentTaskId: null,
      description: null, priority: 'MEDIUM', status: 'NOT_STARTED',
      dueDate: null, completedAt: null, observations: null,
    });
    onDone();
  };
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px',
      background: T.accentSoft, borderRadius: T.r2, marginBottom: 8,
    }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone(); }}
        placeholder="Título de la nueva tarea…"
        style={{
          flex: 1, fontSize: 14, fontFamily: T.fontUI, background: T.surface,
          border: `1px solid ${T.line}`, borderRadius: T.r1, padding: '8px 12px',
          outline: 'none', color: T.ink,
        }}
      />
      <select value={subjectId} onChange={e => setSubjectId(e.target.value)} style={{
        fontSize: 13, fontFamily: T.fontUI, background: T.surface,
        border: `1px solid ${T.line}`, borderRadius: T.r1, padding: '8px 10px',
        color: T.ink, outline: 'none',
      }}>
        <option value="">— General</option>
        {subjects.filter(s => s.isActive).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <Button size="sm" variant="primary" onClick={submit} disabled={!title.trim()}>Agregar</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>✕</Button>
    </div>
  );
}

function TaskRow({ task, subject, now }: { task: Task; subject?: Subject; now: Date }) {
  const [hover, setHover] = useState(false);
  const toggle = useToggleTask();
  const remove = useDeleteTask();
  const update = useUpdateTask();

  const isOverdue = task.dueDate && task.status !== 'COMPLETED' && daysBetween(task.dueDate, now) < 0;

  const COL: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    borderBottom: `1px solid ${T.lineSoft}`, minHeight: 48,
  };

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      display: 'grid',
      gridTemplateColumns: '40px 1fr 130px 100px 110px 110px 40px',
      background: hover ? T.bgAlt : 'transparent', transition: 'background 100ms',
    }}>
      {/* Checkbox */}
      <div style={{ ...COL, justifyContent: 'center' }}>
        <Checkbox checked={task.status === 'COMPLETED'} size={18} onChange={() => toggle.mutate(task)} />
      </div>
      {/* Título + obs */}
      <div style={{ ...COL, flexDirection: 'column', alignItems: 'flex-start', padding: '8px 12px', gap: 2 }}>
        <span style={{
          fontSize: 14, fontFamily: T.fontUI, color: T.ink,
          fontWeight: 500, textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none',
          textDecorationColor: T.inkMuted,
        }}>{task.title}</span>
        {task.observations && (
          <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.fontDisplay, fontStyle: 'italic',
            maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ↳ {task.observations}
          </span>
        )}
      </div>
      {/* Materia */}
      <div style={COL}><SubjectChip subject={subject} compact /></div>
      {/* Prioridad (clickable cycler) */}
      <div style={COL}>
        <InlineCycler<TaskPriorityKey>
          value={task.priority} cycle={PRIORITY_CYCLE}
          render={v => <PriorityChip value={v} compact />}
          onChange={v => update.mutate({ id: task.id, changes: { priority: v } })}
        />
      </div>
      {/* Fecha límite */}
      <div style={{ ...COL, fontSize: 12, fontFamily: T.fontUI,
        color: isOverdue ? T.danger : T.inkSoft, fontWeight: isOverdue ? 600 : 400 }}>
        {task.dueDate ? relativeLabel(task.dueDate, now) : <span style={{ color: T.inkMuted }}>—</span>}
      </div>
      {/* Estado (clickable cycler) */}
      <div style={COL}>
        <InlineCycler<TaskStatusKey>
          value={task.status} cycle={STATUS_CYCLE}
          render={v => <StatusChip value={v} compact />}
          onChange={v => update.mutate({ id: task.id, changes: {
            status: v,
            completedAt: v === 'COMPLETED' ? new Date().toISOString() : null,
          }})}
        />
      </div>
      {/* Acciones */}
      <div style={{ ...COL, justifyContent: 'center' }}>
        {hover && <IconButton icon="trash" size={26} onClick={() => remove.mutate(task.id)} />}
      </div>
    </div>
  );
}

export function TasksTable() {
  const now = new Date();
  const { data: subjects = [] } = useSubjects();
  const { data: tasks    = [] } = useTasks();
  const [adding,        setAdding]        = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');

  const subjectById = Object.fromEntries(subjects.map(s => [s.id, s]));

  const filtered = tasks
    .filter(t => !filterSubject || t.subjectId === filterSubject)
    .filter(t => !filterStatus  || t.status   === filterStatus);

  const SEL: React.CSSProperties = {
    fontSize: 12, fontFamily: T.fontUI, background: T.surfaceAlt,
    border: `1px solid ${T.line}`, borderRadius: T.rFull, padding: '6px 10px',
    color: T.ink, outline: 'none',
  };
  const HDR: React.CSSProperties = {
    fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
    color: T.inkMuted, fontWeight: 600, fontFamily: T.fontUI,
    padding: '0 0 10px',
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <SectionTitle size="lg">Todas las tareas</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.fontUI, marginTop: 2 }}>
            {filtered.length} de {tasks.length} tareas
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={SEL}>
            <option value="">Todas las materias</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={SEL}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setAdding(true)}>Nueva tarea</Button>
        </div>
      </div>

      {adding && <AddTaskForm subjects={subjects} onDone={() => setAdding(false)} />}

      {/* Tabla */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.r3, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 130px 100px 110px 110px 40px',
          borderBottom: `1px solid ${T.line}`, padding: '0 0 0 40px',
          background: T.surfaceAlt,
        }}>
          {['Tarea','Materia','Prioridad','Vence','Estado',''].map((h,i) => (
            <div key={i} style={{ ...HDR, padding: '12px 8px' }}>{h}</div>
          ))}
        </div>

        {filtered.length === 0 && <div style={{ padding: 24 }}><EmptyState text="No hay tareas con esos filtros." /></div>}

        {filtered.map(t => <TaskRow key={t.id} task={t} subject={subjectById[t.subjectId ?? '']} now={now} />)}
      </div>
    </div>
  );
}
