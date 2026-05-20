import { driveService, DriveAuthError } from '../drive/DriveService';
import { exportAll, importAll } from '../db/db';
import { mergeLastWriteWins, type SyncSnapshot } from './mergeLastWriteWins';
import type { DriveDataFile } from '../types';

// ─── Constantes de retry (sec. 3.5) ──────────────────────────────────────────

const MAX_RETRIES      = 10;
const BASE_DELAY_MS    = 1_000;
const MAX_DELAY_MS     = 512_000;  // ~8.5 minutos
const MAX_AUTH_RETRIES = 2;

const LOCAL_SYNC_SNAPSHOT_KEY = 'uniplanner-sync-snapshot';

function getLocalSyncSnapshot(): SyncSnapshot | null {
  const raw = localStorage.getItem(LOCAL_SYNC_SNAPSHOT_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as SyncSnapshot; }
  catch { return null; }
}

function setLocalSyncSnapshot(remote: DriveDataFile): void {
  const snap: SyncSnapshot = {
    subjectIds:      (remote.subjects      ?? []).map(s => s.id),
    taskIds:         (remote.tasks         ?? []).map(t => t.id),
    eventIds:        (remote.events        ?? []).map(e => e.id),
    quickNoteIds:    (remote.quickNotes    ?? []).map(n => n.id),
    personalListIds: (remote.personalLists ?? []).map(l => l.id),
  };
  localStorage.setItem(LOCAL_SYNC_SNAPSHOT_KEY, JSON.stringify(snap));
}

const EMPTY_DRIVE_FILE: Omit<DriveDataFile, 'exportedAt'> = {
  version: 1,
  subjects: [],
  tasks: [],
  events: [],
  quickNotes: [],
  personalLists: [],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
}

// ─── Configuración del servicio ───────────────────────────────────────────────

export interface SyncConfig {
  /** Devuelve el access token en memoria (puede ser null si no autenticado). */
  getAccessToken: () => string | null;
  /** Renueva el token via GIS y devuelve el nuevo valor. */
  refreshToken: () => Promise<string>;
  /** Devuelve el ID del usuario autenticado actual. */
  getUserId: () => string | null;
  onSyncStart?: () => void;
  onSyncSuccess?: () => void;
  /** Llamado tras 10 fallos consecutivos para mostrar el banner de error. */
  onSyncError?: (message: string) => void;
}

// ─── SyncService ──────────────────────────────────────────────────────────────

export class SyncService {
  private fileId: string | null = null;
  private periodicInterval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: SyncConfig) {}

  /**
   * Inicialización al arrancar la app (sec. 3.3):
   * Busca el archivo en Drive, valida que pertenece al usuario actual,
   * y hace el primer pull/merge. Si no existe o está contaminado, crea archivo vacío.
   */
  async initialize(): Promise<void> {
    const token = await this.getToken();
    const currentUserId = this.config.getUserId();
    this.fileId = await driveService.findFile(token);

    const emptyFile: DriveDataFile = {
      ...EMPTY_DRIVE_FILE,
      userId: currentUserId ?? '',
      exportedAt: new Date().toISOString(),
    };

    if (!this.fileId) {
      this.fileId = await driveService.createFile(emptyFile, token);
      return;
    }

    const remote = await driveService.downloadFile(this.fileId, token);
    if (!remote) return;

    // Caso 1: userId de otro usuario → definitivamente contaminado
    if (remote.userId && remote.userId !== currentUserId) {
      await driveService.updateFile(this.fileId, emptyFile, token);
      await importAll(emptyFile);
      setLocalSyncSnapshot(emptyFile);
      return;
    }

    // Caso 2: sin userId (archivo legacy o contaminado antes del fix)
    if (!remote.userId) {
      const local = await exportAll();
      const hasLocalHistory =
        local.subjects.length > 0 || local.tasks.length > 0 ||
        local.events.length > 0  || local.quickNotes.length > 0 ||
        local.personalLists.length > 0 || !!getLocalSyncSnapshot();

      if (!hasLocalHistory) {
        const lastOwner = localStorage.getItem('up-local-data-owner');
        if (lastOwner !== currentUserId) {
          // Diferente usuario (o desconocido) usó este dispositivo → contaminación probable
          await driveService.updateFile(this.fileId, emptyFile, token);
          await importAll(emptyFile);
          setLocalSyncSnapshot(emptyFile);
          return;
        }
        // Mismo usuario hizo logout y volvió → local vacío es normal → confiar en Drive
      }
    }

    // Caso 3: userId correcto, o legacy con historial local → pull normal
    await this.pull(token);
  }

  /**
   * Patrón obligatorio de guardado (sec. 3.4):
   * Descargar → Leer local → Merge → Importar a Dexie → Subir a Drive.
   *
   * Implementa backoff exponencial (sec. 3.5) y renovación de token (sec. 3.6).
   */
  async save(): Promise<void> {
    this.config.onSyncStart?.();

    let attempt     = 0;
    let authRetries = 0;

    while (attempt < MAX_RETRIES) {
      try {
        await this.doSave();
        this.config.onSyncSuccess?.();
        return;
      } catch (err) {
        // Token vencido en mid-save: renovar y reintentar desde paso 1 (sec. 3.6)
        if (err instanceof DriveAuthError && authRetries < MAX_AUTH_RETRIES) {
          authRetries++;
          try {
            await this.config.refreshToken();
            continue; // Reintentar sin contar como fallo
          } catch {
            break;    // Si no se puede renovar, dejar de intentar
          }
        }

        attempt++;
        if (attempt < MAX_RETRIES) {
          await sleep(exponentialDelay(attempt - 1));
        }
      }
    }

    this.config.onSyncError?.(
      'No se pudo sincronizar. Tus datos están guardados localmente.',
    );
  }

  /** Inicia sincronización periódica en background. Retorna la función cleanup. */
  schedulePeriodicSync(intervalMs = 5 * 60 * 1_000): () => void {
    if (this.periodicInterval) clearInterval(this.periodicInterval);
    this.periodicInterval = setInterval(() => {
      this.save().catch(console.error);
    }, intervalMs);

    return () => {
      if (this.periodicInterval) {
        clearInterval(this.periodicInterval);
        this.periodicInterval = null;
      }
    };
  }

  // ─── Implementación interna ─────────────────────────────────────────────────

  private async getToken(): Promise<string> {
    const token = this.config.getAccessToken();
    return token ?? this.config.refreshToken();
  }

  /** Pull puro: descarga Drive, mergea con local e importa resultado a Dexie. */
  private async pull(token: string): Promise<void> {
    if (!this.fileId) return;
    const remote = await driveService.downloadFile(this.fileId, token);
    if (!remote) return;
    const local  = await exportAll();
    const merged = mergeLastWriteWins(remote, local, getLocalSyncSnapshot());
    await importAll(merged);
    setLocalSyncSnapshot(remote);
  }

  /** Ejecuta el ciclo completo de guardado (sec. 3.4). */
  private async doSave(): Promise<void> {
    const token = await this.getToken();

    // Paso 1: Asegurar fileId
    if (!this.fileId) {
      this.fileId = await driveService.findFile(token);
    }

    // Paso 2: Descargar estado remoto
    const remote: DriveDataFile = this.fileId
      ? (await driveService.downloadFile(this.fileId, token)) ?? {
          ...EMPTY_DRIVE_FILE,
          exportedAt: new Date().toISOString(),
        }
      : { ...EMPTY_DRIVE_FILE, exportedAt: new Date().toISOString() };

    // Paso 3: Leer estado local
    const local = await exportAll();

    // Paso 4: Merge Last-Write-Wins
    const merged = mergeLastWriteWins(remote, local, getLocalSyncSnapshot());

    // Paso 5: Importar merged a Dexie (actualiza local con entidades remotas más nuevas)
    await importAll(merged);
    setLocalSyncSnapshot(remote);

    // Paso 6: Subir resultado a Drive (incluir userId del usuario actual)
    const currentUserId = this.config.getUserId();
    const toUpload = { ...merged, userId: currentUserId ?? '' };
    if (this.fileId) {
      await driveService.updateFile(this.fileId, toUpload, token);
    } else {
      this.fileId = await driveService.createFile(toUpload, token);
    }
  }
}
