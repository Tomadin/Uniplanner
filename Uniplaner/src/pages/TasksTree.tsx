import { useState } from 'react';
import { T, PRIORITY_META, PRIORITY_CYCLE } from '../design/tokens';
import type { TaskPriorityKey } from '../design/tokens';
import { SectionTitle, Card, EmptyState } from '../components/ui/Misc';
import { Button, Checkbox, IconButton } from '../components/ui/Button';
import { PriorityChip } from '../components/ui/Chips';
import { Icon } from '../components/ui/Icon';
import { useSubjects } from '../hooks/useSubjects';
import { useTasks, useAddTask, useToggleTask, useDeleteTask, useUpdateTask } from '../hooks/useTasks';
import { relativeLabel, daysBetween } from '../utils/date';
import type { Task } from '../types';

// ─── Formulario de nueva tarea ────────────────────────────────────────────────

function AddTaskForm({ subjectId, parentTaskId = null, onDone }: {
  subjectId: string | null;
  parentTaskId?: string | null;
  onDone: () => void;
}) {
  const [title,    setTitle]    = useState('');
  const [dueDate,  setDueDate]  = useState('');
  const [priority, setPriority] = useState<TaskPriorityKey>('MEDIUM');
  const add = useAddTask();
  const INPUT: React.CSSProperties = {
    fontSize: 13, fontFamily: T.fontUI, background: T.surfaceAlt,
    border: `1px solid ${T.line}`, borderRadius: T.r1,
    padding: '8px 10px', outline: 'none', color: T.ink,
  };
  const submit = () => {
    if (!title.trim()) return;
    add.mutate({
      subjectId, parentTaskId, title: title.trim(),
      description: null, priority, status: 'NOT_STARTED',
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      completedAt: null, observations: null,
    });
    onDone();
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 6px', flexWrap: 'wrap' }}>
      <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onDone(); }}
        placeholder="Título de la tarea…"
        style={{
          flex: 1, minWidth: 160, fontSize: 14, fontFamily: T.fontUI, background: T.surfaceAlt,
          border: `1px solid ${T.accent}`, borderRadius: T.r1,
          padding: '8px 12px', outline: 'none', color: T.ink,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI, whiteSpace: 'nowrap' }}>Prioridad:</span>
        <select value={priority} onChange={e => setPriority(e.target.value as TaskPriorityKey)}
          style={{ ...INPUT, background: PRIORITY_META[priority].bg, color: PRIORITY_META[priority].fg, fontWeight: 500 }}>
          {PRIORITY_CYCLE.filter(p => p !== 'NONE').map(p => (
            <option key={p} value={p} style={{ background: PRIORITY_META[p].bg, color: PRIORITY_META[p].fg }}>
              {PRIORITY_META[p].label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI, whiteSpace: 'nowrap' }}>Vence:</span>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          title="Fecha de vencimiento (opcional)" style={INPUT}
        />
      </div>
      <Button size="sm" variant="soft" onClick={submit} disabled={!title.trim()}>Agregar</Button>
      <Button size="sm" variant="ghost" onClick={onDone}>✕</Button>
    </div>
  );
}

// ─── Nodo de tarea (recursivo) ────────────────────────────────────────────────
// La indentación del árbol viene del CONTAINER, no del nodo.
// depth se usa solo para el fontWeight del título (negrita en raíz).

function TaskNode({ task, depth = 0, childrenOf, now }: {
  task: Task; depth?: number;
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

  const isCompleted = task.status === 'COMPLETED' || task.status === 'CANCELLED';
  const isOverdue   = task.dueDate && !isCompleted && daysBetween(task.dueDate, now) < 0;

  const cyclePriority = () => {
    const cycle = PRIORITY_CYCLE.filter(p => p !== 'NONE');
    const idx  = cycle.indexOf(task.priority as typeof cycle[number]);
    const next = cycle[(idx + 1) % cycle.length];
    update.mutate({ id: task.id, changes: { priority: next } });
  };

  return (
    <div>
      <div
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 6px',
          borderRadius: T.r1, opacity: isCompleted ? 0.55 : 1,
          background: hover ? T.bgAlt : 'transparent', transition: 'background 100ms',
        }}>
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
          <div onClick={cyclePriority} style={{ cursor: 'pointer' }} title="Clic para cambiar prioridad">
            <PriorityChip value={task.priority} compact />
          </div>
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
        <AddTaskForm subjectId={task.subjectId} parentTaskId={task.id} onDone={() => setAddKid(false)} />
      )}

      {open && kids.length > 0 && (
        <div style={{
          marginLeft: 22,
          paddingLeft: 18,
          borderLeft: `2px solid ${T.line}`,
          marginTop: 1,
          marginBottom: 2,
        }}>
          {kids.map(k => (
            <div key={k.id} style={{ position: 'relative' }}>
              {/* Rama horizontal desde la línea vertical al contenido */}
              <div style={{
                position: 'absolute', left: -18, top: 21,
                width: 14, height: 2, background: T.line,
              }} />
              <TaskNode task={k} depth={depth + 1} childrenOf={childrenOf} now={now} />
            </div>
          ))}
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
