import type { DriveDataFile, Subject, Task, Event, QuickNote } from '../types';
import type { LocalSnapshot } from '../db/db';

// ─── Utilidad pura de merge (sec. 3.4 y 6.4) ─────────────────────────────────
//
// Estrategia Last-Write-Wins por campo `updatedAt` (ISO 8601 comparable
// lexicográficamente). Entidades presentes en un solo lado se incluyen
// directamente sin conflicto.

type Identifiable = { id: string; updatedAt: string };

function mergeCollection<T extends Identifiable>(remote: T[], local: T[]): T[] {
  const merged = new Map<string, T>();

  for (const item of remote) {
    merged.set(item.id, item);
  }

  for (const item of local) {
    const existing = merged.get(item.id);
    // ISO strings son comparables lexicográficamente: "2026-04..." > "2026-03..."
    if (!existing || item.updatedAt > existing.updatedAt) {
      merged.set(item.id, item);
    }
  }

  return Array.from(merged.values());
}

/**
 * Función pura que combina el estado remoto (Drive) con el estado local (Dexie).
 *
 * - Para cada colección, por cada `id` en conflicto, gana el objeto con
 *   `updatedAt` más reciente.
 * - Objetos únicos de cualquier lado se incluyen sin modificación.
 * - No muta los argumentos de entrada.
 */
export function mergeLastWriteWins(
  remote: DriveDataFile,
  local: LocalSnapshot,
): DriveDataFile {
  return {
    version: remote.version ?? 1,
    exportedAt: new Date().toISOString(),
    subjects:   mergeCollection<Subject>(remote.subjects   ?? [], local.subjects),
    tasks:      mergeCollection<Task>   (remote.tasks      ?? [], local.tasks),
    events:     mergeCollection<Event>  (remote.events     ?? [], local.events),
    quickNotes: mergeCollection<QuickNote>(remote.quickNotes ?? [], local.quickNotes),
  };
}

// ─── Ejemplo de uso (para tests y documentación) ─────────────────────────────
//
// const remote: DriveDataFile = {
//   version: 1, exportedAt: '2026-05-01T10:00:00Z',
//   subjects: [{ id: 'abc', name: 'Anatomía', color: '#D98880',
//                isActive: true, createdAt: '2026-01-01T00:00:00Z',
//                updatedAt: '2026-05-01T09:00:00Z' }],
//   tasks: [], events: [], quickNotes: [],
// };
//
// const local: LocalSnapshot = {
//   subjects: [{ id: 'abc', name: 'Anatomía II', color: '#D98880',
//                isActive: true, createdAt: '2026-01-01T00:00:00Z',
//                updatedAt: '2026-05-01T10:30:00Z' }],  // ← más reciente, gana
//   tasks: [], events: [], quickNotes: [],
// };
//
// const result = mergeLastWriteWins(remote, local);
// // result.subjects[0].name === 'Anatomía II'  ✓
