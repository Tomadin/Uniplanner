import { describe, it, expect } from 'vitest';
import { exportAll, importAll, clearLocalData, purgeExpiredTasks } from './db';
import type { LocalSnapshot } from './db';
import type { Task } from '../types/index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkSnapshot(extra: Partial<LocalSnapshot> = {}): LocalSnapshot {
  return { subjects: [], tasks: [], events: [], quickNotes: [], personalLists: [], ...extra };
}

function mkTask(id: string, status: Task['status'], completedAt: string | null = null): Task {
  return {
    id, subjectId: null, parentTaskId: null, title: 'T',
    description: null, priority: 'MEDIUM', status,
    dueDate: null, completedAt, observations: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('exportAll', () => {
  it('con DB vacía retorna arrays vacíos en todas las colecciones', async () => {
    const snap = await exportAll();
    expect(snap.subjects).toHaveLength(0);
    expect(snap.tasks).toHaveLength(0);
    expect(snap.events).toHaveLength(0);
    expect(snap.quickNotes).toHaveLength(0);
    expect(snap.personalLists).toHaveLength(0);
  });
});

describe('importAll', () => {
  it('carga datos correctamente y se pueden leer con exportAll', async () => {
    const data = mkSnapshot({
      subjects: [{
        id: 's1', name: 'Algo', color: '#111', isActive: true,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }],
      tasks: [mkTask('t1', 'NOT_STARTED')],
    });
    await importAll(data);
    const snap = await exportAll();
    expect(snap.subjects).toHaveLength(1);
    expect(snap.subjects[0].id).toBe('s1');
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].id).toBe('t1');
  });

  it('reemplaza datos previos sin dejar registros fantasma', async () => {
    await importAll(mkSnapshot({ tasks: [mkTask('old', 'NOT_STARTED')] }));
    await importAll(mkSnapshot({ tasks: [mkTask('new', 'NOT_STARTED')] }));
    const snap = await exportAll();
    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].id).toBe('new');
  });
});

describe('clearLocalData', () => {
  it('borra todas las tablas', async () => {
    await importAll(mkSnapshot({
      subjects: [{
        id: 's1', name: 'X', color: '#000', isActive: true,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }],
      tasks: [mkTask('t1', 'NOT_STARTED')],
    }));
    await clearLocalData();
    const snap = await exportAll();
    expect(snap.subjects).toHaveLength(0);
    expect(snap.tasks).toHaveLength(0);
  });

  it('seguido de exportAll retorna todo vacío', async () => {
    await importAll(mkSnapshot({ tasks: [mkTask('t1', 'NOT_STARTED')] }));
    await clearLocalData();
    const snap = await exportAll();
    expect(Object.values(snap).every(arr => arr.length === 0)).toBe(true);
  });
});

describe('aislamiento entre usuarios (crítico)', () => {
  it('datos de usuario A no persisten después de clearLocalData + importAll de usuario B', async () => {
    // Usuario A
    await importAll(mkSnapshot({ tasks: [mkTask('task-a', 'IN_PROGRESS')] }));
    let snap = await exportAll();
    expect(snap.tasks[0].id).toBe('task-a');

    // Cambio de usuario
    await clearLocalData();
    await importAll(mkSnapshot({ tasks: [mkTask('task-b', 'NOT_STARTED')] }));
    snap = await exportAll();

    expect(snap.tasks).toHaveLength(1);
    expect(snap.tasks[0].id).toBe('task-b');
  });
});

describe('purgeExpiredTasks', () => {
  it('elimina tareas COMPLETED con completedAt hace más de 7 días', async () => {
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    await importAll(mkSnapshot({ tasks: [mkTask('t1', 'COMPLETED', old)] }));
    await purgeExpiredTasks();
    const snap = await exportAll();
    expect(snap.tasks).toHaveLength(0);
  });

  it('NO elimina tareas COMPLETED completadas recientemente', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    await importAll(mkSnapshot({ tasks: [mkTask('t1', 'COMPLETED', recent)] }));
    await purgeExpiredTasks();
    const snap = await exportAll();
    expect(snap.tasks).toHaveLength(1);
  });

  it('NO elimina tareas NOT_STARTED ni IN_PROGRESS', async () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    await importAll(mkSnapshot({
      tasks: [
        mkTask('t1', 'NOT_STARTED', old),
        mkTask('t2', 'IN_PROGRESS', old),
      ],
    }));
    await purgeExpiredTasks();
    const snap = await exportAll();
    expect(snap.tasks).toHaveLength(2);
  });
});
