import { useState, useRef } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { T, STATUS_META, PRIORITY_META, PRIORITY_CYCLE, STATUS_CYCLE } from '../design/tokens';
import type { TaskPriorityKey, TaskStatusKey } from '../design/tokens';
import { SectionTitle, EmptyState } from '../components/ui/Misc';
import { Button, Checkbox, IconButton } from '../components/ui/Button';
import { DateInput } from '../components/ui/DateInput';
import { PriorityChip, StatusChip, SubjectChip } from '../components/ui/Chips';
import { useSubjects } from '../hooks/useSubjects';
import { useTasks, useAddTask, useToggleTask, useDeleteTask, useUpdateTask } from '../hooks/useTasks';
import { relativeLabel, daysBetween } from '../utils/date';
import type { Subject, Task } from '../types';

const PRIORITY_CYCLE_NO_NONE  = PRIORITY_CYCLE.filter(p => p !== 'NONE');
const STATUS_CYCLE_INTERACTIVE = STATUS_CYCLE.filter(s => s !== 'CANCELLED');

function UndoToast({ task, onUndo }: { task: Task; onUndo: () => void }) {
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      background: T.ink, color: T.surface, borderRadius: T.r2,
      padding: '10px 16px', display: 'flex', gap: 12, alignItems: 'center',
      fontFamily: T.fontUI, fontSize: 13, zIndex: 1000, boxShadow: T.shadowMd,
      whiteSpace: 'nowrap',
    }}>
      <span>Tarea <b>"{task.title}"</b> eliminada</span>
      <button onClick={onUndo} style={{
        background: T.accentSoft, color: T.accentInk, border: 'none',
        borderRadius: T.r1, padding: '4px 10px', cursor: 'pointer',
        fontFamily: T.fontUI, fontSize: 12, fontWeight: 600,
      }}>Deshacer</button>
    </div>
  );
}

function InlineCycler<T extends string>({ value, cycle, render, onChange }: {
  value: T; cycle: T[]; render: (v: T) => React.ReactNode; onChange: (v: T) => void;
}) {
  const [hover, setHover] = useState(false);
  const next = () => { const idx = cycle.indexOf(value); onChange(cycle[(idx + 1) % cycle.length]); };
  return (
    <div
      onClick={next}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        cursor: 'pointer', display: 'inline-block', borderRadius: T.rFull,
        transform: hover ? 'scale(1.04)' : 'scale(1)',
        boxShadow: hover ? T.shadowSm : 'none',
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
      title="Clic para cambiar"
    >{render(value)}</div>
  );
}

function AddTaskForm({ onDone, subjects, mobile }: { onDone: () => void; subjects: Subject[]; mobile: boolean }) {
  const [title,     setTitle]     = useState('');
  const [subjectId, setSubjectId] = useState<string>('');
  const [dueDate,   setDueDate]   = useState('');
  const [priority,  setPriority]  = useState<TaskPriorityKey>('MEDIUM');
  const add = useAddTask();
  const submit = () => {
    if (!title.trim()) return;
    add.mutate({
      title: title.trim(), subjectId: subjectId || null, parentTaskId: null,
      description: null, priority, status: 'NOT_STARTED',
      dueDate: dueDate || null,
      completedAt: null, observations: null,
    });
    onDone();
  };
  const INPUT: React.CSSProperties = {
    fontSize: 13, fontFamily: T.fontUI, background: T.surface,
    border: `1px solid ${T.line}`, borderRadius: T.r1, padding: '8px 10px',
    color: T.ink, outline: 'none',
  };
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px',
      background: T.accentSoft, borderRadius: T.r2, marginBottom: 8, flexWrap: 'wrap',
    }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone(); }}
        placeholder="Título de la nueva tarea…"
        style={{ ...INPUT, flex: 1, minWidth: 120, fontSize: 14 }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {!mobile && <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI, whiteSpace: 'nowrap' }}>Materia:</span>}
        <select value={subjectId} onChange={e => setSubjectId(e.target.value)} style={INPUT} title="Materia">
          <option value="">— General</option>
          {subjects.filter(s => s.isActive).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {!mobile && <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI, whiteSpace: 'nowrap' }}>Prioridad:</span>}
        <select value={priority} onChange={e => setPriority(e.target.value as TaskPriorityKey)}
          style={{ ...INPUT, background: PRIORITY_META[priority].bg, color: PRIORITY_META[priority].fg, fontWeight: 500 }}
          title="Prioridad">
          {PRIORITY_CYCLE.filter(p => p !== 'NONE').map(p => (
            <option key={p} value={p} style={{ background: PRIORITY_META[p].bg, color: PRIORITY_META[p].fg }}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {!mobile && <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI, whiteSpace: 'nowrap' }}>Vence:</span>}
        <DateInput value={dueDate} onChange={setDueDate}
          title="Fecha de vencimiento (opcional)" style={INPUT}
        />
      </div>
      <Button size="sm" variant="primary" onClick={submit} disabled={!title.trim()}>Agregar</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>✕</Button>
    </div>
  );
}

function TaskRow({ task, subject, now, onDelete }: { task: Task; subject?: Subject; now: Date; onDelete: (t: Task) => void }) {
  const [hover,        setHover]        = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDate,  setEditingDate]  = useState(false);
  const [titleDraft,   setTitleDraft]   = useState(task.title);
  const [dateDraft,    setDateDraft]    = useState(
    task.dueDate ? task.dueDate.split('T')[0] : ''
  );
  const toggle = useToggleTask();
  const update = useUpdateTask();

  const isDone    = task.status === 'COMPLETED' || task.status === 'CANCELLED';
  const isOverdue = task.dueDate && !isDone && daysBetween(task.dueDate, now) < 0;

  const COL: React.CSSProperties = {
    display: 'flex', alignItems: 'center',
    borderBottom: `1px solid ${T.lineSoft}`, minHeight: 48,
  };

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      display: 'grid',
      gridTemplateColumns: '40px 1fr 130px 100px 110px 110px 76px',
      background: hover ? T.bgAlt : isOverdue ? T.dangerSoft : 'transparent',
      borderLeft: `3px solid ${isOverdue ? T.danger : 'transparent'}`,
      opacity: isDone ? 0.55 : 1,
      transition: 'background 100ms, opacity 150ms',
    }}>
      {/* Checkbox */}
      <div style={{ ...COL, justifyContent: 'center' }}>
        <Checkbox checked={task.status === 'COMPLETED'} size={18} onChange={() => toggle.mutate(task)} />
      </div>
      {/* Título + obs */}
      <div style={{ ...COL, flexDirection: 'column', alignItems: 'flex-start', padding: '8px 12px', gap: 2 }}>
        {editingTitle ? (
          <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={() => {
              update.mutate({ id: task.id, changes: { title: titleDraft.trim() || task.title } });
              setEditingTitle(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
            }}
            style={{ fontSize: 14, fontFamily: T.fontUI, color: T.ink, fontWeight: 500,
              background: T.surfaceAlt, border: `1px solid ${T.accent}`,
              borderRadius: T.r1, padding: '2px 8px', outline: 'none', width: '100%' }}
          />
        ) : (
          <span
            onDoubleClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
            title="Doble clic para editar"
            style={{ fontSize: 14, fontFamily: T.fontUI, color: T.ink, fontWeight: 500,
              textDecoration: isDone ? 'line-through' : 'none',
              textDecorationColor: T.inkMuted, cursor: 'text' }}
          >{task.title}</span>
        )}
        {task.observations && (
          <span style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.fontDisplay, fontStyle: 'italic',
            maxWidth: 460, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            ↳ {task.observations}
          </span>
        )}
        {task.status === 'COMPLETED' && task.completedAt && (
          <span style={{ fontSize: 11, color: T.inkMuted, fontFamily: T.fontUI }}>
            Completada {relativeLabel(task.completedAt, now)}
          </span>
        )}
      </div>
      {/* Materia */}
      <div style={{ ...COL, overflow: 'hidden' }}><SubjectChip subject={subject} compact /></div>
      {/* Prioridad (clickable cycler — sin NONE en ciclo) */}
      <div style={COL}>
        <InlineCycler<TaskPriorityKey>
          value={task.priority} cycle={PRIORITY_CYCLE_NO_NONE}
          render={v => <PriorityChip value={v} compact />}
          onChange={v => update.mutate({ id: task.id, changes: { priority: v } })}
        />
      </div>
      {/* Fecha límite — click para editar */}
      <div style={{ ...COL, fontSize: 12, fontFamily: T.fontUI,
        color: isOverdue ? T.danger : T.inkSoft, fontWeight: isOverdue ? 600 : 400 }}>
        {editingDate ? (
          <DateInput
            autoFocus
            value={dateDraft}
            onChange={setDateDraft}
            onBlur={() => {
              update.mutate({ id: task.id, changes: { dueDate: dateDraft || null } });
              setEditingDate(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') {
                setDateDraft(task.dueDate ? task.dueDate.split('T')[0] : '');
                setEditingDate(false);
              }
            }}
            style={{ fontSize: 12, fontFamily: T.fontUI, color: T.ink, background: T.surfaceAlt,
              border: `1px solid ${T.accent}`, borderRadius: T.r1, padding: '2px 6px', outline: 'none' }}
          />
        ) : (
          <span onClick={() => { setDateDraft(task.dueDate ? task.dueDate.split('T')[0] : ''); setEditingDate(true); }}
            title="Clic para editar fecha" style={{ cursor: 'pointer' }}>
            {task.dueDate ? relativeLabel(task.dueDate, now) : <span style={{ color: T.inkMuted }}>—</span>}
          </span>
        )}
      </div>
      {/* Estado (clickable cycler — sin CANCELLED en ciclo) */}
      <div style={COL}>
        <InlineCycler<TaskStatusKey>
          value={task.status} cycle={STATUS_CYCLE_INTERACTIVE}
          render={v => <StatusChip value={v} compact />}
          onChange={v => update.mutate({ id: task.id, changes: {
            status: v,
            completedAt: v === 'COMPLETED' ? new Date().toISOString() : null,
          }})}
        />
      </div>
      {/* Acciones */}
      <div style={{ ...COL, justifyContent: 'center', gap: 4 }}>
        {hover && (
          <>
            <IconButton
              icon="x"
              size={26}
              title={task.status === 'CANCELLED' ? 'Quitar cancelación' : 'Cancelar tarea'}
              onClick={() => update.mutate({ id: task.id, changes: {
                status: task.status === 'CANCELLED' ? 'NOT_STARTED' : 'CANCELLED',
                completedAt: null,
              }})}
            />
            <IconButton icon="trash" size={26} title="Eliminar tarea" onClick={() => onDelete(task)} />
          </>
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, subject, now, onDelete }: {
  task: Task; subject?: Subject; now: Date; onDelete: (t: Task) => void;
}) {
  const toggle = useToggleTask();
  const update = useUpdateTask();
  const isDone    = task.status === 'COMPLETED' || task.status === 'CANCELLED';
  const isOverdue = task.dueDate && !isDone && daysBetween(task.dueDate, now) < 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '12px 14px', borderBottom: `1px solid ${T.lineSoft}`,
      background: isOverdue ? T.dangerSoft : 'transparent',
      borderLeft: `3px solid ${isOverdue ? T.danger : 'transparent'}`,
      opacity: isDone ? 0.55 : 1,
    }}>
      <div style={{ paddingTop: 2 }}>
        <Checkbox checked={task.status === 'COMPLETED'} size={18} onChange={() => toggle.mutate(task)} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontFamily: T.fontUI, fontWeight: 500, color: T.ink,
          textDecoration: isDone ? 'line-through' : 'none',
          textDecorationColor: T.inkMuted, marginBottom: 6 }}>
          {task.title}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <SubjectChip subject={subject} compact />
          <InlineCycler<TaskPriorityKey>
            value={task.priority} cycle={PRIORITY_CYCLE_NO_NONE}
            render={v => <PriorityChip value={v} compact />}
            onChange={v => update.mutate({ id: task.id, changes: { priority: v } })}
          />
          {task.dueDate && (
            <span style={{ fontSize: 11, fontFamily: T.fontUI,
              color: isOverdue ? T.danger : T.inkSoft, fontWeight: isOverdue ? 600 : 400 }}>
              {relativeLabel(task.dueDate, now)}
            </span>
          )}
          <InlineCycler<TaskStatusKey>
            value={task.status} cycle={STATUS_CYCLE_INTERACTIVE}
            render={v => <StatusChip value={v} compact />}
            onChange={v => update.mutate({ id: task.id, changes: {
              status: v,
              completedAt: v === 'COMPLETED' ? new Date().toISOString() : null,
            }})}
          />
        </div>
        {task.observations && (
          <div style={{ fontSize: 12, color: T.inkSoft, fontFamily: T.fontDisplay,
            fontStyle: 'italic', marginTop: 4 }}>
            ↳ {task.observations}
          </div>
        )}
      </div>
      <IconButton icon="trash" size={26} title="Eliminar tarea" onClick={() => onDelete(task)} />
    </div>
  );
}

export function TasksTable() {
  const now = new Date();
  const { mobile } = useResponsive();
  const { data: subjects = [] } = useSubjects();
  const { data: tasks    = [] } = useTasks();
  const [adding,         setAdding]         = useState(false);
  const [showCompleted,  setShowCompleted]  = useState(false);
  const [filterSubject,  setFilterSubject]  = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [pendingDelete,  setPendingDelete]  = useState<Task | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remove = useDeleteTask();

  const handleDelete = (task: Task) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingDelete(task);
    timerRef.current = setTimeout(() => {
      remove.mutate(task.id);
      setPendingDelete(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPendingDelete(null);
  };

  const subjectById = Object.fromEntries(subjects.map(s => [s.id, s]));
  const hiddenCount = tasks.filter(t => t.status === 'COMPLETED' || t.status === 'CANCELLED').length;

  const filtered = tasks
    .filter(t => showCompleted || (t.status !== 'COMPLETED' && t.status !== 'CANCELLED'))
    .filter(t => !filterSubject  || t.subjectId === filterSubject)
    .filter(t => !filterStatus   || t.status    === filterStatus)
    .filter(t => !filterPriority || t.priority  === filterPriority);

  const visible = filtered.filter(t => t.id !== pendingDelete?.id);

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
    <div style={{ padding: mobile ? 16 : 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <SectionTitle size="lg">Todas las tareas</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.fontUI, marginTop: 2 }}>
            {visible.length} de {tasks.length} tareas
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
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            style={{
              ...SEL,
              ...(filterPriority
                ? { background: PRIORITY_META[filterPriority as TaskPriorityKey].bg,
                    color:      PRIORITY_META[filterPriority as TaskPriorityKey].fg,
                    fontWeight: 600 }
                : {}),
            }}>
            <option value="">Todas las prioridades</option>
            {PRIORITY_CYCLE.map(p => (
              <option key={p} value={p} style={{ background: PRIORITY_META[p].bg, color: PRIORITY_META[p].fg }}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </select>
          <button onClick={() => setShowCompleted(v => !v)} style={{
            fontSize: 12, fontFamily: T.fontUI, padding: '6px 12px',
            borderRadius: T.rFull, border: `1px solid ${T.line}`, cursor: 'pointer',
            background: showCompleted ? T.accentSoft : T.surfaceAlt,
            color: showCompleted ? T.accentInk : T.inkSoft,
          }}>
            {showCompleted ? 'Ocultar completadas' : `Mostrar completadas (${hiddenCount})`}
          </button>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setAdding(true)}>Nueva tarea</Button>
        </div>
      </div>

      {adding && <AddTaskForm subjects={subjects} mobile={mobile} onDone={() => setAdding(false)} />}

      {/* Tabla / Tarjetas */}
      <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: T.r3, overflow: 'hidden' }}>
        {!mobile && (
          <div style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 130px 100px 110px 110px 76px',
            borderBottom: `1px solid ${T.line}`, background: T.surfaceAlt,
          }}>
            {['','Tarea','Materia','Prioridad','Vence','Estado',''].map((h,i) => (
              <div key={i} style={{ ...HDR, padding: '12px 8px' }}>{h}</div>
            ))}
          </div>
        )}
        {visible.length === 0 && <div style={{ padding: 24 }}><EmptyState text="No hay tareas con esos filtros." /></div>}
        {visible.map(t => mobile
          ? <TaskCard key={t.id} task={t} subject={subjectById[t.subjectId ?? '']} now={now} onDelete={handleDelete} />
          : <TaskRow  key={t.id} task={t} subject={subjectById[t.subjectId ?? '']} now={now} onDelete={handleDelete} />
        )}
      </div>

      {pendingDelete && <UndoToast task={pendingDelete} onUndo={handleUndo} />}
    </div>
  );
}
