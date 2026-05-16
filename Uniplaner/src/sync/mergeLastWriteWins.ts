import type { DriveDataFile, Subject, Task, Event, QuickNote, PersonalList } from '../types';
import type { LocalSnapshot } from '../db/db';

// ─── Utilidad pura de merge (sec. 3.4 y 6.4) ─────────────────────────────────
//
// Estrategia Last-Write-Wins por campo `updatedAt` (ISO 8601 comparable
// lexicográficamente). Entidades presentes en un solo lado se incluyen
// directamente sin conflicto.

type Identifiable = { id: string; updatedAt: string };

/**
 * Snapshot de los IDs que estaban en Drive en el último sync exitoso de este
 * dispositivo. Se persiste en localStorage y se usa para distinguir entre
 * "eliminé este ítem" y "nunca lo tuve porque vino de otro dispositivo".
 */
export interface SyncSnapshot {
  subjectIds:      string[];
  taskIds:         string[];
  eventIds:        string[];
  quickNoteIds:    string[];
  personalListIds: string[];
}

/**
 * Merge con detección de eliminaciones basada en IDs reales.
 *
 * Para cada ítem de remote que NO está en local:
 *   - Su ID estaba en lastSyncedIds → lo vimos en Drive y ahora no está en local
 *                                     → lo eliminamos localmente → descartar
 *   - Su ID NO estaba en lastSyncedIds (o lastSyncedIds es null) → es nuevo de
 *                                     otro dispositivo, nunca lo vimos → incluir
 *
 * Usar IDs reales en lugar de timestamps evita el falso positivo donde un ítem
 * con updatedAt antiguo se descarta porque su fecha es menor al exportedAt del
 * último sync, aunque ese ítem nunca hubiera estado en Drive en ese momento.
 */
function mergeCollection<T extends Identifiable>(
  remote: T[],
  local: T[],
  lastSyncedIds: Set<string> | null,
): T[] {
  const merged   = new Map<string, T>();
  const localIds = new Set(local.map(item => item.id));

  for (const item of remote) {
    if (localIds.has(item.id)) {
      // Existe en ambos lados: LWW (se resuelve abajo con la pasada local)
      merged.set(item.id, item);
    } else if (lastSyncedIds === null || !lastSyncedIds.has(item.id)) {
      // No está en local Y (primer sync O no estaba en nuestro último snapshot)
      // → llegó de otro dispositivo → incluir
      merged.set(item.id, item);
    }
    // else: estaba en nuestro último snapshot y ya no está en local → eliminado localmente
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
 *
 * @param lastSync  Snapshot de IDs del último sync de este dispositivo.
 *                  null = primer sync → incluir todos los ítems de Drive.
 */
export function mergeLastWriteWins(
  remote: DriveDataFile,
  local: LocalSnapshot,
  lastSync: SyncSnapshot | null,
): DriveDataFile {
  return {
    version:    remote.version ?? 1,
    exportedAt: new Date().toISOString(),
    subjects:      mergeCollection<Subject>      (remote.subjects      ?? [], local.subjects,      lastSync ? new Set(lastSync.subjectIds)      : null),
    tasks:         mergeCollection<Task>         (remote.tasks         ?? [], local.tasks,         lastSync ? new Set(lastSync.taskIds)         : null),
    events:        mergeCollection<Event>        (remote.events        ?? [], local.events,         lastSync ? new Set(lastSync.eventIds)        : null),
    quickNotes:    mergeCollection<QuickNote>    (remote.quickNotes    ?? [], local.quickNotes,    lastSync ? new Set(lastSync.quickNoteIds)    : null),
    personalLists: mergeCollection<PersonalList> (remote.personalLists ?? [], local.personalLists, lastSync ? new Set(lastSync.personalListIds) : null),
  };
}
