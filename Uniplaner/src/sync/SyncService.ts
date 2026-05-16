import { driveService, DriveAuthError } from '../drive/DriveService';
import { exportAll, importAll } from '../db/db';
import { mergeLastWriteWins } from './mergeLastWriteWins';
import type { DriveDataFile } from '../types';

// ─── Constantes de retry (sec. 3.5) ──────────────────────────────────────────

const MAX_RETRIES      = 10;
const BASE_DELAY_MS    = 1_000;
const MAX_DELAY_MS     = 512_000;  // ~8.5 minutos
const MAX_AUTH_RETRIES = 2;

const LOCAL_SYNC_REF_KEY = 'uniplanner-last-sync-ref';

function getLocalSyncRef(): string | null {
  return localStorage.getItem(LOCAL_SYNC_REF_KEY);
}

function setLocalSyncRef(exportedAt: string): void {
  localStorage.setItem(LOCAL_SYNC_REF_KEY, exportedAt);
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
   * Busca el archivo en Drive y hace el primer pull/merge.
   * Si no existe el archivo, lo crea con los datos locales.
   */
  async initialize(): Promise<void> {
    const token = await this.getToken();
    this.fileId = await driveService.findFile(token);

    if (this.fileId) {
      await this.pull(token);
    } else {
      const local = await exportAll();
      const newFile: DriveDataFile = {
        ...EMPTY_DRIVE_FILE,
        exportedAt: new Date().toISOString(),
        ...local,
      };
      this.fileId = await driveService.createFile(newFile, token);
    }
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
    const merged = mergeLastWriteWins(remote, local, getLocalSyncRef());
    await importAll(merged);
    setLocalSyncRef(remote.exportedAt);
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
    const merged = mergeLastWriteWins(remote, local, getLocalSyncRef());

    // Paso 5: Importar merged a Dexie (actualiza local con entidades remotas más nuevas)
    await importAll(merged);
    setLocalSyncRef(remote.exportedAt);

    // Paso 6: Subir resultado a Drive
    if (this.fileId) {
      await driveService.updateFile(this.fileId, merged, token);
    } else {
      this.fileId = await driveService.createFile(merged, token);
    }
  }
}
