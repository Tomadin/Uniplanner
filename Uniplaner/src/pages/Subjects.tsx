import { useState } from 'react';
import { useResponsive } from '../hooks/useResponsive';
import { T, SUBJECT_COLORS } from '../design/tokens';
import { SectionTitle, EmptyState } from '../components/ui/Misc';
import { Button, Checkbox, IconButton } from '../components/ui/Button';
import { useSubjects, useAddSubject, useUpdateSubject, useDeleteSubject } from '../hooks/useSubjects';
import { useTasks } from '../hooks/useTasks';
import type { Subject, ScheduleSlot } from '../types';

type Filter = 'active' | 'inactive' | 'all';

// ─── Configuración de días ─────────────────────────────────────────────────────

const DAYS_CONFIG = [
  { label: 'Lunes',     dayOfWeek: 1 as ScheduleSlot['dayOfWeek'] },
  { label: 'Martes',    dayOfWeek: 2 as ScheduleSlot['dayOfWeek'] },
  { label: 'Miércoles', dayOfWeek: 3 as ScheduleSlot['dayOfWeek'] },
  { label: 'Jueves',    dayOfWeek: 4 as ScheduleSlot['dayOfWeek'] },
  { label: 'Viernes',   dayOfWeek: 5 as ScheduleSlot['dayOfWeek'] },
  { label: 'Sábado',    dayOfWeek: 6 as ScheduleSlot['dayOfWeek'] },
];

type DaySlot = { enabled: boolean; start: string; end: string };

// ─── Editor (crear / editar materia) ──────────────────────────────────────────

function SubjectEditor({
  subject,
  onSave,
  onCancel,
  onDelete,
}: {
  subject?: Subject;
  onSave: (data: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>, regenerateEvents?: boolean) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name,     setName]     = useState(subject?.name ?? '');
  const [color,    setColor]    = useState(subject?.color ?? SUBJECT_COLORS[0]);
  const [isActive, setIsActive] = useState(subject?.isActive ?? true);

  const [slots, setSlots] = useState<DaySlot[]>(() =>
    DAYS_CONFIG.map(({ dayOfWeek }) => {
      const ex = subject?.schedule?.find(s => s.dayOfWeek === dayOfWeek);
      return ex
        ? { enabled: true,  start: ex.startTime, end: ex.endTime }
        : { enabled: false, start: '08:00',       end: '10:00'   };
    })
  );
  const [courseEnd,   setCourseEnd]   = useState(subject?.courseEndDate?.slice(0, 10) ?? '');
  const [regen,       setRegen]       = useState(true);
  const [confirmDel,  setConfirmDel]  = useState(false);

  const valid       = name.trim().length > 0;
  const hasSchedule = slots.some(s => s.enabled);
  const isEditing   = !!subject;

  const updateSlot = (i: number, patch: Partial<DaySlot>) =>
    setSlots(prev => prev.map((s, j) => j === i ? { ...s, ...patch } : s));

  const submit = () => {
    if (!valid) return;
    const schedule: ScheduleSlot[] = DAYS_CONFIG.flatMap(({ dayOfWeek }, i) =>
      slots[i].enabled
        ? [{ dayOfWeek, startTime: slots[i].start, endTime: slots[i].end }]
        : []
    );
    const courseEndDate = (hasSchedule && courseEnd)
      ? new Date(courseEnd).toISOString()
      : null;
    onSave({ name: name.trim(), color, isActive, schedule, courseEndDate }, isEditing ? regen : undefined);
  };

  const INPUT: React.CSSProperties = {
    padding: '6px 10px', fontSize: 13, fontFamily: T.fontUI,
    background: T.surfaceAlt, border: `1px solid ${T.line}`,
    borderRadius: T.r1, color: T.ink, outline: 'none', boxSizing: 'border-box',
  };

  const LABEL: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: 0.7,
    textTransform: 'uppercase', color: T.inkMuted,
    fontFamily: T.fontUI, marginBottom: 8, display: 'block',
  };

  return (
    <div style={{
      background: T.surface, border: `2px solid ${T.accent}`,
      borderRadius: T.r3, padding: 24, display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {/* Nombre */}
      <input
        autoFocus value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && valid) submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Nombre de la materia…"
        style={{
          fontSize: 18, fontFamily: T.fontDisplay, background: 'transparent',
          border: 'none', outline: 'none', color: T.ink,
          borderBottom: `1px solid ${T.line}`, paddingBottom: 8,
        }}
      />

      {/* Paleta de colores */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SUBJECT_COLORS.map(c => (
          <button key={c} onClick={() => setColor(c)} style={{
            width: 28, height: 28, borderRadius: '50%', background: c,
            border: color === c ? `2px solid ${T.ink}` : '2px solid transparent',
            cursor: 'pointer', outline: 'none',
          }} />
        ))}
      </div>

      {/* Horario del cursado */}
      <div>
        <span style={LABEL}>Horario del cursado (opcional)</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
          {DAYS_CONFIG.map((day, i) => (
            <div key={day.dayOfWeek} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36 }}>
              <Checkbox checked={slots[i].enabled} onChange={v => updateSlot(i, { enabled: v })} />
              <span style={{
                fontSize: 13, fontFamily: T.fontUI, color: slots[i].enabled ? T.ink : T.inkMuted,
                width: 72, flexShrink: 0,
              }}>
                {day.label}
              </span>
              {slots[i].enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="time" value={slots[i].start}
                    onChange={e => updateSlot(i, { start: e.target.value })}
                    style={{ ...INPUT, width: 88 }}
                  />
                  <span style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI }}>→</span>
                  <input
                    type="time" value={slots[i].end}
                    onChange={e => updateSlot(i, { end: e.target.value })}
                    style={{ ...INPUT, width: 88 }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Fecha fin — solo cuando hay algún día activo */}
        {hasSchedule && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.inkSoft, whiteSpace: 'nowrap' }}>
              Fin del cursado:
            </span>
            <input
              type="date" value={courseEnd}
              onChange={e => setCourseEnd(e.target.value)}
              style={{ ...INPUT, width: 160 }}
            />
          </div>
        )}
      </div>

      {/* Estado activo */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <Checkbox checked={isActive} onChange={v => setIsActive(v)} />
        <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.inkSoft }}>
          Materia activa (cuatrimestre actual)
        </span>
      </label>

      {/* Toggle regenerar — solo en edición con horario */}
      {isEditing && hasSchedule && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <Checkbox checked={regen} onChange={v => setRegen(v)} />
          <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.inkSoft }}>
            Actualizar eventos del calendario
          </span>
        </label>
      )}

      {/* Confirmación de eliminar inline */}
      {confirmDel ? (
        <div style={{
          padding: '12px 14px', borderRadius: T.r2,
          background: T.dangerSoft, border: `1px solid ${T.danger}44`,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.ink }}>
            ¿Eliminar "{subject?.name}"? Se eliminarán también todos sus eventos del calendario. Las tareas quedarán sin materia.
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="danger" size="sm" onClick={onDelete}>Sí, eliminar</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {onDelete && <Button variant="danger" size="sm" onClick={() => setConfirmDel(true)}>Eliminar</Button>}
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" size="sm" disabled={!valid} onClick={submit}>
            {isEditing ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta de materia ────────────────────────────────────────────────────────

function SubjectCard({ subject, taskCount, onEdit, onToggleActive }: {
  subject: Subject; taskCount: number;
  onEdit: () => void; onToggleActive: () => void;
}) {
  const [hover, setHover] = useState(false);
  const hasSchedule = (subject.schedule?.length ?? 0) > 0;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{
      background: T.surface, border: `1px solid ${T.line}`,
      borderRadius: T.r3, padding: 20, position: 'relative', overflow: 'hidden',
      opacity: subject.isActive ? 1 : 0.65, transition: 'all 150ms',
      boxShadow: hover ? T.shadowMd : 'none',
    }}>
      {/* Strip de color */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, background: subject.color }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 400, color: T.ink, letterSpacing: -0.2 }}>
            {subject.name}
          </div>
          <div style={{ fontSize: 12, color: T.inkMuted, fontFamily: T.fontUI, marginTop: 4 }}>
            {taskCount} tarea{taskCount !== 1 ? 's' : ''} activa{taskCount !== 1 ? 's' : ''}
            {hasSchedule && (
              <span style={{ marginLeft: 8, color: T.accentInk }}>
                · {subject.schedule!.length} día{subject.schedule!.length !== 1 ? 's' : ''} de clase
              </span>
            )}
          </div>
        </div>
        <IconButton icon="pencil" size={28} onClick={onEdit} />
      </div>

      <button onClick={onToggleActive} style={{
        fontSize: 11, fontFamily: T.fontUI, letterSpacing: 0.5,
        background: subject.isActive ? T.accentSoft : T.bgAlt,
        color: subject.isActive ? T.accentInk : T.inkSoft,
        border: 'none', borderRadius: T.rFull, padding: '4px 10px',
        cursor: 'pointer', fontWeight: 500,
      }}>
        {subject.isActive ? 'Activa' : 'Inactiva'}
      </button>
    </div>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

export function Subjects() {
  const { mobile } = useResponsive();
  const { data: subjects = [] } = useSubjects();
  const { data: tasks    = [] } = useTasks();
  const addSubject    = useAddSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  const [filter,    setFilter]    = useState<Filter>('active');
  const [adding,    setAdding]    = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = subjects.filter(s =>
    filter === 'active' ? s.isActive : filter === 'inactive' ? !s.isActive : true
  );

  const activeTaskCount = (id: string) =>
    tasks.filter(t => t.subjectId === id && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length;

  return (
    <div style={{ padding: mobile ? 16 : 32, maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <SectionTitle size="lg">Mis materias</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.fontUI, marginTop: 2 }}>
            {subjects.filter(s => s.isActive).length} activas · {subjects.filter(s => !s.isActive).length} anteriores
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', background: T.surfaceAlt, padding: 3, borderRadius: T.rFull, gap: 2 }}>
            {(['active','inactive','all'] as Filter[]).map((v, i) => {
              const labels = ['Activas','Anteriores','Todas'];
              return (
                <button key={v} onClick={() => setFilter(v)} style={{
                  padding: '6px 12px', fontSize: 12, fontFamily: T.fontUI,
                  background: filter === v ? T.surface : 'transparent',
                  color: filter === v ? T.ink : T.inkSoft,
                  border: 'none', borderRadius: T.rFull, cursor: 'pointer',
                  fontWeight: 500, boxShadow: filter === v ? T.shadowSm : 'none',
                }}>{labels[i]}</button>
              );
            })}
          </div>
          <Button variant="primary" size="sm" icon="plus" onClick={() => setAdding(true)}>Nueva</Button>
        </div>
      </div>

      <div style={{
        display: 'grid', gap: 16,
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      }}>
        {/* Editor de creación — ocupa todo el ancho */}
        {adding && (
          <div style={{ gridColumn: '1 / -1' }}>
            <SubjectEditor
              onSave={(data) => { addSubject.mutate(data); setAdding(false); }}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {filtered.length === 0 && !adding && (
          <div style={{ gridColumn: '1/-1' }}>
            <EmptyState text="No hay materias en esta categoría." />
          </div>
        )}

        {filtered.map(s => {
          if (editingId === s.id) {
            return (
              // Editor de edición — ocupa todo el ancho
              <div key={s.id} style={{ gridColumn: '1 / -1' }}>
                <SubjectEditor
                  subject={s}
                  onSave={(data, regenerateEvents) => {
                    updateSubject.mutate({ id: s.id, changes: data, regenerateEvents });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => {
                    deleteSubject.mutate(s.id);
                    setEditingId(null);
                  }}
                />
              </div>
            );
          }
          return (
            <SubjectCard key={s.id} subject={s}
              taskCount={activeTaskCount(s.id)}
              onEdit={() => setEditingId(s.id)}
              onToggleActive={() => updateSubject.mutate({ id: s.id, changes: { isActive: !s.isActive } })}
            />
          );
        })}
      </div>
    </div>
  );
}
