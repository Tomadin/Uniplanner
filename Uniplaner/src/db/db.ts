import Dexie, { type EntityTable } from 'dexie';
import type { Subject, Task, Event, QuickNote } from '../types';

// ─── Instancia Dexie (sec. 4.1) ───────────────────────────────────────────────

class UniPlannerDB extends Dexie {
  subjects!: EntityTable<Subject, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  events!: EntityTable<Event, 'id'>;
  quickNotes!: EntityTable<QuickNote, 'id'>;

  constructor() {
    super('UniPlanner');
    this.version(1).stores({
      subjects:   '&id, isActive, updatedAt',
      tasks:      '&id, subjectId, parentTaskId, status, dueDate, updatedAt',
      events:     '&id, subjectId, startTime, isExam, updatedAt',
      quickNotes: '&id, updatedAt',
    });
  }
}

export const db = new UniPlannerDB();

// ─── Helpers de exportación / importación ─────────────────────────────────────

export interface LocalSnapshot {
  subjects: Subject[];
  tasks: Task[];
  events: Event[];
  quickNotes: QuickNote[];
}

export async function exportAll(): Promise<LocalSnapshot> {
  const [subjects, tasks, events, quickNotes] = await Promise.all([
    db.subjects.toArray(),
    db.tasks.toArray(),
    db.events.toArray(),
    db.quickNotes.toArray(),
  ]);
  return { subjects, tasks, events, quickNotes };
}

export async function importAll(data: LocalSnapshot): Promise<void> {
  await db.transaction('rw', [db.subjects, db.tasks, db.events, db.quickNotes], async () => {
    await Promise.all([
      db.subjects.bulkPut(data.subjects),
      db.tasks.bulkPut(data.tasks),
      db.events.bulkPut(data.events),
      db.quickNotes.bulkPut(data.quickNotes),
    ]);
  });
}

// Elimina tareas completadas con más de 7 días (RF-07)
export async function purgeExpiredTasks(): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.tasks
    .where('status')
    .equals('COMPLETED')
    .filter((t) => !!t.completedAt && t.completedAt < sevenDaysAgo)
    .delete();
}
