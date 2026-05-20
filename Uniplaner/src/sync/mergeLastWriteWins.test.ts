import { describe, it, expect } from 'vitest';
import { mergeLastWriteWins, type SyncSnapshot } from './mergeLastWriteWins';
import type { DriveDataFile, Subject, Task } from '../types/index';
import type { LocalSnapshot } from '../db/db';

// ─── Fábricas de entidades mínimas ────────────────────────────────────────────

function mkSubject(id: string, updatedAt: string): Subject {
  return { id, name: 'Mat', color: '#000', isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt };
}

function mkTask(id: string, updatedAt: string): Task {
  return {
    id, subjectId: null, parentTaskId: null, title: 'Tarea',
    description: null, priority: 'MEDIUM', status: 'NOT_STARTED',
    dueDate: null, completedAt: null, observations: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt,
  };
}

function emptyRemote(extra: Partial<DriveDataFile> = {}): DriveDataFile {
  return {
    version: 1, exportedAt: '2026-01-01T00:00:00Z',
    subjects: [], tasks: [], events: [], quickNotes: [], personalLists: [],
    ...extra,
  };
}

function emptyLocal(extra: Partial<LocalSnapshot> = {}): LocalSnapshot {
  return { subjects: [], tasks: [], events: [], quickNotes: [], personalLists: [], ...extra };
}

function mkSnapshot(subjectIds: string[] = [], taskIds: string[] = []): SyncSnapshot {
  return { subjectIds, taskIds, eventIds: [], quickNoteIds: [], personalListIds: [] };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('mergeLastWriteWins — LWW básico', () => {
  it('gana el ítem remoto cuando tiene updatedAt más reciente', () => {
    const older = mkSubject('s1', '2026-01-01T00:00:00Z');
    const newer = mkSubject('s1', '2026-06-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote({ subjects: [newer] }),
      emptyLocal({ subjects: [older] }),
      null,
    );
    expect(result.subjects[0].updatedAt).toBe(newer.updatedAt);
  });

  it('gana el ítem local cuando tiene updatedAt más reciente', () => {
    const older = mkSubject('s1', '2026-01-01T00:00:00Z');
    const newer = mkSubject('s1', '2026-06-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote({ subjects: [older] }),
      emptyLocal({ subjects: [newer] }),
      null,
    );
    expect(result.subjects[0].updatedAt).toBe(newer.updatedAt);
  });
});

describe('mergeLastWriteWins — ítems únicos', () => {
  it('incluye ítem que solo existe en local', () => {
    const local = mkSubject('s1', '2026-05-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote(),
      emptyLocal({ subjects: [local] }),
      null,
    );
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].id).toBe('s1');
  });

  it('incluye ítem solo en remote cuando lastSync=null (primer sync)', () => {
    const remote = mkSubject('s1', '2026-05-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote({ subjects: [remote] }),
      emptyLocal(),
      null,
    );
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].id).toBe('s1');
  });

  it('incluye ítem solo en remote cuyo ID no estaba en el último snapshot (otro dispositivo)', () => {
    const remote = mkSubject('s2', '2026-05-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote({ subjects: [remote] }),
      emptyLocal(),
      mkSnapshot(['s1']),   // s2 nunca lo vimos antes → llegó de otro dispositivo
    );
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].id).toBe('s2');
  });
});

describe('mergeLastWriteWins — detección de eliminaciones', () => {
  it('excluye ítem remoto que estaba en lastSync pero fue eliminado de local', () => {
    const remote = mkSubject('s1', '2026-05-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote({ subjects: [remote] }),
      emptyLocal(),                    // s1 ya no está en local
      mkSnapshot(['s1']),              // pero sí estaba en el último sync → eliminado localmente
    );
    expect(result.subjects).toHaveLength(0);
  });

  it('mantiene ítem local que fue eliminado de remote (eliminación remota no fuerza borrado local)', () => {
    const local = mkSubject('s1', '2026-05-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote(),                   // s1 no está en remote
      emptyLocal({ subjects: [local] }),
      mkSnapshot(['s1']),              // estaba en el último sync
    );
    expect(result.subjects).toHaveLength(1);
    expect(result.subjects[0].id).toBe('s1');
  });

  it('no incluye ítem eliminado de ambos lados', () => {
    const result = mergeLastWriteWins(
      emptyRemote(),
      emptyLocal(),
      mkSnapshot(['s1']),
    );
    expect(result.subjects).toHaveLength(0);
  });
});

describe('mergeLastWriteWins — edge cases', () => {
  it('remote vacío + local con datos → resultado = local', () => {
    const s = mkSubject('s1', '2026-05-01T00:00:00Z');
    const t = mkTask('t1', '2026-05-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote(),
      emptyLocal({ subjects: [s], tasks: [t] }),
      null,
    );
    expect(result.subjects).toHaveLength(1);
    expect(result.tasks).toHaveLength(1);
  });

  it('remote con datos + local vacío + lastSync=null → resultado = remote', () => {
    const s = mkSubject('s1', '2026-05-01T00:00:00Z');
    const result = mergeLastWriteWins(
      emptyRemote({ subjects: [s] }),
      emptyLocal(),
      null,
    );
    expect(result.subjects).toHaveLength(1);
  });

  it('ambos vacíos → resultado vacío', () => {
    const result = mergeLastWriteWins(emptyRemote(), emptyLocal(), null);
    expect(result.subjects).toHaveLength(0);
    expect(result.tasks).toHaveLength(0);
    expect(result.events).toHaveLength(0);
  });

  it('las colecciones se mergean de forma independiente', () => {
    const s = mkSubject('s1', '2026-05-01T00:00:00Z');    // solo en remote → eliminado localmente
    const t = mkTask('t1', '2026-05-01T00:00:00Z');        // solo en local → se incluye

    const result = mergeLastWriteWins(
      emptyRemote({ subjects: [s] }),
      emptyLocal({ tasks: [t] }),
      mkSnapshot(['s1'], []),  // s1 estaba en snapshot → eliminación local propagada
    );
    expect(result.subjects).toHaveLength(0);  // s1 eliminado localmente
    expect(result.tasks).toHaveLength(1);     // t1 sobrevive
  });
});
