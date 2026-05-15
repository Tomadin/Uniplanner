import type { DriveDataFile, Subject, Task, Event, QuickNote, PersonalList } from '../types';
import type { LocalSnapshot } from '../db/db';

// ─── Utilidad pura de merge (sec. 3.4 y 6.4) ─────────────────────────────────
//
// Estrategia Last-Write-Wins por campo `updatedAt` (ISO 8601 comparable
// lexicográficamente). Entidades presentes en un solo lado se incluyen
// directamente sin conflicto.

type Identifiable = { id: string; updatedAt: string };

/**
 * Merge con detección de eliminaciones.
 *
 * Si un item existe en remote pero NO en local, usamos `remoteExportedAt`
 * (el timestamp de la última subida a Drive) como referencia:
 *   - item.updatedAt > remoteExportedAt  → item nuevo de otro dispositivo → incluir
 *   - item.updatedAt ≤ remoteExportedAt  → item ya estaba en la última sync y
 *                                          fue eliminado localmente → descartar
 *
 * Esto evita que eliminaciones locales sean sobreescritas por el sync siguiente.
 */
function mergeCollection<T extends Identifiable>(
  remote: T[],
  local: T[],
  remoteExportedAt: string,
): T[] {
  const merged  = new Map<string, T>();
  const localIds = new Set(local.map(item => item.id));

  for (const item of remote) {
    if (localIds.has(item.id)) {
      // Existe en ambos lados: LWW (se resuelve abajo con la pasada local)
      merged.set(item.id, item);
    } else if (item.updatedAt > remoteExportedAt) {
      // No está en local PERO es más nuevo que la última exportación:
      // vino de otro dispositivo después del último sync → incluir
      merged.set(item.id, item);
    }
    // Caso restante: estaba en Drive cuando se hizo el último sync pero ya no
    // está en local → fue eliminado localmente → no incluir
  }

  for (const item of local) {
    const existing = merged.get(item.id);
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
  const ref = remote.exportedAt ?? new Date(0).toISOString();
  return {
    version:    remote.version ?? 1,
    exportedAt: new Date().toISOString(),
    subjects:      mergeCollection<Subject>      (remote.subjects      ?? [], local.subjects,      ref),
    tasks:         mergeCollection<Task>         (remote.tasks         ?? [], local.tasks,         ref),
    events:        mergeCollection<Event>        (remote.events        ?? [], local.events,         ref),
    quickNotes:    mergeCollection<QuickNote>    (remote.quickNotes    ?? [], local.quickNotes,    ref),
    personalLists: mergeCollection<PersonalList> (remote.personalLists ?? [], local.personalLists, ref),
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
