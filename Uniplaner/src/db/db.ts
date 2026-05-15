import Dexie, { type EntityTable } from 'dexie';
import type { Subject, Task, Event, QuickNote, PersonalList } from '../types';

// ─── Instancia Dexie (sec. 4.1) ───────────────────────────────────────────────

class UniPlannerDB extends Dexie {
  subjects!: EntityTable<Subject, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  events!: EntityTable<Event, 'id'>;
  quickNotes!: EntityTable<QuickNote, 'id'>;
  personalLists!: EntityTable<PersonalList, 'id'>;

  constructor() {
    super('UniPlanner');
    this.version(1).stores({
      subjects:   '&id, isActive, updatedAt',
      tasks:      '&id, subjectId, parentTaskId, status, dueDate, updatedAt',
      events:     '&id, subjectId, startTime, isExam, updatedAt',
      quickNotes: '&id, updatedAt',
    });
    this.version(2).stores({
      subjects:      '&id, isActive, updatedAt',
      tasks:         '&id, subjectId, parentTaskId, status, dueDate, updatedAt',
      events:        '&id, subjectId, startTime, isExam, updatedAt',
      quickNotes:    '&id, updatedAt',
      personalLists: '&id, updatedAt',
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
  personalLists: PersonalList[];
}

export async function exportAll(): Promise<LocalSnapshot> {
  const [subjects, tasks, events, quickNotes, personalLists] = await Promise.all([
    db.subjects.toArray(),
    db.tasks.toArray(),
    db.events.toArray(),
    db.quickNotes.toArray(),
    db.personalLists.toArray(),
  ]);
  return { subjects, tasks, events, quickNotes, personalLists };
}

export async function importAll(data: LocalSnapshot): Promise<void> {
  await db.transaction('rw', [db.subjects, db.tasks, db.events, db.quickNotes, db.personalLists], async () => {
    await Promise.all([
      db.subjects.bulkPut(data.subjects),
      db.tasks.bulkPut(data.tasks),
      db.events.bulkPut(data.events),
      db.quickNotes.bulkPut(data.quickNotes),
      db.personalLists.bulkPut(data.personalLists ?? []),
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
