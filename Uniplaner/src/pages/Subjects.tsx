import { useState } from 'react';
import { T, SUBJECT_COLORS } from '../design/tokens';
import { SectionTitle, EmptyState } from '../components/ui/Misc';
import { Button, IconButton } from '../components/ui/Button';
import { useSubjects, useAddSubject, useUpdateSubject, useDeleteSubject } from '../hooks/useSubjects';
import { useTasks } from '../hooks/useTasks';
import type { Subject } from '../types';

type Filter = 'active' | 'inactive' | 'all';

// ─── Editor (crear / editar materia) ──────────────────────────────────────────

function SubjectEditor({
  subject,
  onSave,
  onCancel,
  onDelete,
}: {
  subject?: Subject;
  onSave: (data: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name,     setName]     = useState(subject?.name ?? '');
  const [color,    setColor]    = useState(subject?.color ?? SUBJECT_COLORS[0]);
  const [isActive, setIsActive] = useState(subject?.isActive ?? true);

  const valid = name.trim().length > 0;

  return (
    <div style={{
      background: T.surface, border: `2px solid ${T.accent}`,
      borderRadius: T.r3, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <input
        autoFocus value={name} onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && valid) onSave({ name: name.trim(), color, isActive }); if (e.key === 'Escape') onCancel(); }}
        placeholder="Nombre de la materia…"
        style={{
          fontSize: 18, fontFamily: T.fontDisplay, background: 'transparent',
          border: 'none', outline: 'none', color: T.ink, borderBottom: `1px solid ${T.line}`, paddingBottom: 8,
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

      {/* Estado activo */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
        <span style={{ fontSize: 13, fontFamily: T.fontUI, color: T.inkSoft }}>Materia activa (cuatrimestre actual)</span>
      </label>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {onDelete && <Button variant="danger" size="sm" onClick={onDelete}>Eliminar</Button>}
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" size="sm" disabled={!valid}
          onClick={() => valid && onSave({ name: name.trim(), color, isActive })}>
          {subject ? 'Guardar' : 'Crear'}
        </Button>
      </div>
    </div>
  );
}

// ─── Tarjeta de materia ────────────────────────────────────────────────────────

function SubjectCard({ subject, taskCount, onEdit, onToggleActive }: {
  subject: Subject; taskCount: number;
  onEdit: () => void; onToggleActive: () => void;
}) {
  const [hover, setHover] = useState(false);
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
    <div style={{ padding: 32, maxWidth: 1080, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <SectionTitle size="lg">Mis materias</SectionTitle>
          <div style={{ fontSize: 13, color: T.inkSoft, fontFamily: T.fontUI, marginTop: 2 }}>
            {subjects.filter(s => s.isActive).length} activas · {subjects.filter(s => !s.isActive).length} anteriores
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Filtro */}
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
        {adding && (
          <SubjectEditor
            onSave={(data) => { addSubject.mutate(data); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        )}

        {filtered.length === 0 && !adding && (
          <div style={{ gridColumn: '1/-1' }}>
            <EmptyState text="No hay materias en esta categoría." />
          </div>
        )}

        {filtered.map(s => {
          if (editingId === s.id) {
            return (
              <SubjectEditor key={s.id} subject={s}
                onSave={(data) => { updateSubject.mutate({ id: s.id, changes: data }); setEditingId(null); }}
                onCancel={() => setEditingId(null)}
                onDelete={() => {
                  if (confirm(`¿Eliminar "${s.name}"? Las tareas asociadas quedarán sin materia.`)) {
                    deleteSubject.mutate(s.id);
                    setEditingId(null);
                  }
                }}
              />
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
