import { useState } from 'react';
import { T } from '../design/tokens';
import { SectionTitle, Card, EmptyState } from '../components/ui/Misc';
import { Button, Checkbox, IconButton } from '../components/ui/Button';
import { PriorityChip } from '../components/ui/Chips';
import { Icon } from '../components/ui/Icon';
import { useSubjects } from '../hooks/useSubjects';
import { useTasks, useAddTask, useToggleTask, useDeleteTask, useUpdateTask } from '../hooks/useTasks';
import { PRIORITY_CYCLE } from '../design/tokens';
import { relativeLabel, daysBetween } from '../utils/date';
import type { Task } from '../types';

// ─── Formulario de nueva tarea ────────────────────────────────────────────────

function AddTaskForm({ subjectId, onDone }: { subjectId: string | null; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const add = useAddTask();
  const submit = () => {
    if (!title.trim()) return;
    add.mutate({
      subjectId, parentTaskId: null, title: title.trim(),
      description: null, priority: 'MEDIUM', status: 'NOT_STARTED',
      dueDate: null, completedAt: null, observations: null,
    });
    onDone();
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 6px' }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone(); }}
        placeholder="Título de la tarea…"
        style={{
          flex: 1, fontSize: 14, fontFamily: T.fontUI, background: T.surfaceAlt,
          border: `1px solid ${T.accent}`, borderRadius: T.r1,
          padding: '8px 12px', outline: 'none', color: T.ink,
        }}
      />
      <Button size="sm" variant="soft" onClick={submit} disabled={!title.trim()}>Agregar</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>✕</Button>
    </div>
  );
}

// ─── Nodo de tarea (recursivo) ────────────────────────────────────────────────

function TaskNode({ task, depth, childrenOf, now }: {
  task: Task; depth: number;
  childrenOf: (id: string) => Task[];
  now: Date;
}) {
  const kids      = childrenOf(task.id);
  const toggle    = useToggleTask();
  const remove    = useDeleteTask();
  const update    = useUpdateTask();
  const [open,    setOpen]    = useState(true);
  const [hover,   setHover]   = useState(false);
  const [addKid,  setAddKid]  = useState(false);

  const isCompleted = task.status === 'COMPLETED';
  const isOverdue   = task.dueDate && !isCompleted && daysBetween(task.dueDate, now) < 0;

  const cyclePriority = () => {
    const idx  = PRIORITY_CYCLE.indexOf(task.priority);
    const next = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length];
    update.mutate({ id: task.id, changes: { priority: next } });
  };

  return (
    <div>
      <div
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 6px', paddingLeft: depth * 28 + 6,
          borderRadius: T.r1, opacity: isCompleted ? 0.55 : 1,
          background: hover ? T.bgAlt : 'transparent', transition: 'background 100ms',
        }}>
        {/* Expand toggle */}
        {kids.length > 0 ? (
          <button onClick={() => setOpen(!open)} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: 0, color: T.inkSoft, display: 'flex',
          }}><Icon name={open ? 'chevDown' : 'chevRight'} size={14} /></button>
        ) : (
          <div style={{ width: 14 }} />
        )}

        <Checkbox checked={isCompleted} size={18} onChange={() => toggle.mutate(task)} />

        <div style={{
          flex: 1, fontSize: 14, fontFamily: T.fontUI, color: T.ink,
          fontWeight: depth === 0 ? 500 : 400,
          textDecoration: isCompleted ? 'line-through' : 'none',
          textDecorationColor: T.inkMuted,
        }}>{task.title}</div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {task.priority !== 'NONE' && (
            <div onClick={cyclePriority} style={{ cursor: 'pointer' }} title="Clic para cambiar prioridad">
              <PriorityChip value={task.priority} compact />
            </div>
          )}
          {task.dueDate && (
            <span style={{
              fontSize: 11, fontFamily: T.fontUI,
              color: isOverdue ? T.danger : T.inkSoft,
              fontWeight: isOverdue ? 600 : 400,
            }}>{relativeLabel(task.dueDate, now)}</span>
          )}
          {hover && (
            <>
              <IconButton icon="plus" size={24} title="Agregar subtarea" onClick={() => setAddKid(true)} />
              <IconButton icon="trash" size={24} onClick={() => remove.mutate(task.id)} />
            </>
          )}
        </div>
      </div>

      {addKid && (
        <div style={{ paddingLeft: (depth + 1) * 28 + 6 }}>
          <AddTaskForm subjectId={task.subjectId} onDone={() => setAddKid(false)} />
        </div>
      )}

      {open && kids.length > 0 && (
        <div style={{
          marginLeft: depth * 28 + 26,
          borderLeft: `1px dashed ${T.line}`, paddingLeft: 2,
        }}>
          {kids.map(k => <TaskNode key={k.id} task={k} depth={depth + 1} childrenOf={childrenOf} now={now} />)}
        </div>
      )}
    </div>
  );
}

// ─── Grupo de materia ─────────────────────────────────────────────────────────

function SubjectGroup({ subjectId, subjectName, subjectColor, tasks, childrenOf, now }: {
  subjectId: string | null; subjectName: string; subjectColor: string;
  tasks: Task[]; childrenOf: (id: string) => Task[]; now: Date;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <Card padding={22}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: subjectColor }} />
        <div style={{
          fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 400,
          color: T.ink, letterSpacing: -0.2, fontStyle: subjectId ? 'normal' : 'italic',
        }}>{subjectName}</div>
        <div style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI, marginLeft: 'auto' }}>
          {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
        </div>
        <IconButton icon="plus" size={26} title="Nueva tarea" onClick={() => setAdding(true)} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {adding && <AddTaskForm subjectId={subjectId} onDone={() => setAdding(false)} />}
        {tasks.map(t => <TaskNode key={t.id} task={t} depth={0} childrenOf={childrenOf} now={now} />)}
        {tasks.length === 0 && !adding && <EmptyState text="Sin tareas. ¡Disfrutalo!" />}
      </div>
    </Card>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

export function TasksTree() {
  const now = new Date();
  const { data: subjects = [] } = useSubjects();
  const { data: tasks    = [] } = useTasks();
  const [adding, setAdding] = useState(false);

  const rootTasks   = tasks.filter(t => !t.parentTaskId);
  const childrenOf  = (id: string) => tasks.filter(t => t.parentTaskId === id);

  const bySubject: Record<string, Task[]> = {};
  rootTasks.forEach(t => {
    const key = t.subjectId ?? '__general__';
    (bySubject[key] ??= []).push(t);
  });

  return (
    <div style={{ padding: 32, maxWidth: 980, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <SectionTitle size="lg">Tareas por materia</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.fontUI, marginTop: 2 }}>Vista de árbol con subtareas</div>
        </div>
        <Button variant="primary" size="sm" icon="plus" onClick={() => setAdding(!adding)}>Nueva tarea</Button>
      </div>

      {adding && (
        <Card padding={16} style={{ marginBottom: 16 }}>
          <AddTaskForm subjectId={null} onDone={() => setAdding(false)} />
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {subjects.filter(s => s.isActive).map(s => {
          const items = bySubject[s.id] ?? [];
          return (
            <SubjectGroup key={s.id}
              subjectId={s.id} subjectName={s.name} subjectColor={s.color}
              tasks={items} childrenOf={childrenOf} now={now}
            />
          );
        })}
        {bySubject['__general__'] && (
          <SubjectGroup
            subjectId={null} subjectName="General" subjectColor={T.inkMuted}
            tasks={bySubject['__general__']} childrenOf={childrenOf} now={now}
          />
        )}
        {subjects.filter(s => s.isActive).length === 0 && !bySubject['__general__'] && (
          <EmptyState text="No hay materias activas. Creá una en Materias." />
        )}
      </div>
    </div>
  );
}
