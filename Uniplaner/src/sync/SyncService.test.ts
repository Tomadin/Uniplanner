import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncService } from './SyncService';
import { exportAll, importAll, clearLocalData } from '../db/db';
import type { DriveDataFile, Task } from '../types/index';

// ─── Mock de DriveService ─────────────────────────────────────────────────────

vi.mock('../drive/DriveService', () => ({
  driveService: {
    findFile:     vi.fn(),
    downloadFile: vi.fn(),
    createFile:   vi.fn(),
    updateFile:   vi.fn(),
  },
  DriveAuthError: class DriveAuthError extends Error {
    constructor() { super('Drive: token inválido (401)'); this.name = 'DriveAuthError'; }
  },
}));

import { driveService, DriveAuthError } from '../drive/DriveService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyFile(userId = 'user-A'): DriveDataFile {
  return {
    version: 1, exportedAt: '2026-01-01T00:00:00Z', userId,
    subjects: [], tasks: [], events: [], quickNotes: [], personalLists: [],
  };
}

function mkTask(id: string): Task {
  return {
    id, subjectId: null, parentTaskId: null, title: 'T',
    description: null, priority: 'MEDIUM', status: 'NOT_STARTED',
    dueDate: null, completedAt: null, observations: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

function mkConfig(overrides: Partial<ConstructorParameters<typeof SyncService>[0]> = {}) {
  return {
    getAccessToken: (): string | null => 'token',
    refreshToken:   vi.fn<[], Promise<string>>().mockResolvedValue('new-token'),
    getUserId:      (): string | null => 'user-A',
    onSyncStart:    vi.fn(),
    onSyncSuccess:  vi.fn(),
    onSyncError:    vi.fn(),
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetAllMocks();
  await clearLocalData();
  localStorage.clear();
});

afterEach(() => { vi.useRealTimers(); });

// ─── save() — happy path ──────────────────────────────────────────────────────

describe('SyncService.save — happy path', () => {
  it('ciclo completo: descarga → mergea → importa → sube; llama onSyncStart/onSyncSuccess', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue(emptyFile());
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const config = mkConfig();
    const svc = new SyncService(config);
    await svc.save();

    expect(config.onSyncStart).toHaveBeenCalledOnce();
    expect(config.onSyncSuccess).toHaveBeenCalledOnce();
    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalledOnce();
    expect(vi.mocked(driveService.findFile)).toHaveBeenCalledOnce();
  });

  it('no llama a findFile si fileId ya estaba cargado', async () => {
    vi.mocked(driveService.downloadFile).mockResolvedValue(emptyFile());
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = new SyncService(mkConfig());
    (svc as unknown as { fileId: string }).fileId = 'file-preloaded';
    await svc.save();

    expect(vi.mocked(driveService.findFile)).not.toHaveBeenCalled();
    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalledOnce();
  });

  it('setLocalSyncSnapshot extrae IDs correctamente de todas las colecciones', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue({
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      userId: 'user-A',
      subjects: [{ id: 's1', name: 'Mat', color: '#000', isActive: true, createdAt: 'x', updatedAt: 'x' }],
      tasks:    [mkTask('t1')],
      events:   [{ id: 'e1', subjectId: null, title: 'E', startTime: 'x', endTime: 'x', isExam: false, recurrenceRule: null, recurrenceEndDate: null, updatedAt: 'x' }],
      quickNotes: [{ id: 'n1', content: 'N', createdAt: 'x', updatedAt: 'x' }],
      personalLists: [{ id: 'l1', name: 'L', items: [], createdAt: 'x', updatedAt: 'x' }],
    });
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = new SyncService(mkConfig());
    await svc.save();

    const snap = JSON.parse(localStorage.getItem('uniplanner-sync-snapshot')!);
    expect(snap.subjectIds).toEqual(['s1']);
    expect(snap.taskIds).toEqual(['t1']);
    expect(snap.eventIds).toEqual(['e1']);
    expect(snap.quickNoteIds).toEqual(['n1']);
    expect(snap.personalListIds).toEqual(['l1']);
  });

  it('usa archivo vacío cuando downloadFile retorna null (rama ?? EMPTY_DRIVE_FILE)', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue(null);
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = new SyncService(mkConfig());
    await svc.save();

    const uploaded = vi.mocked(driveService.updateFile).mock.calls[0][1] as DriveDataFile;
    expect(uploaded.tasks).toHaveLength(0);
    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalledOnce();
  });

  it('usa snapshot previo de localStorage en getLocalSyncSnapshot (rama ?? no-nula)', async () => {
    // Pre-set un snapshot válido en localStorage → cubre línea 18 rama false (raw≠null) y línea 19
    localStorage.setItem('uniplanner-sync-snapshot', JSON.stringify({
      subjectIds: ['s1'], taskIds: [], eventIds: [], quickNoteIds: [], personalListIds: [],
    }));
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue(emptyFile());
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = new SyncService(mkConfig());
    await svc.save();

    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalledOnce();
  });

  it('ignora snapshot inválido en localStorage (rama catch en getLocalSyncSnapshot)', async () => {
    // JSON roto → catch devuelve null sin lanzar excepción
    localStorage.setItem('uniplanner-sync-snapshot', 'INVALID JSON{{{{');
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue(emptyFile());
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = new SyncService(mkConfig());
    await expect(svc.save()).resolves.toBeUndefined();
    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalledOnce();
  });

  it('setLocalSyncSnapshot usa [] cuando el archivo remoto no tiene arrays (ramas ??)', async () => {
    // downloadFile retorna un archivo sin arrays definidos
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue({
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      userId: 'user-A',
    } as unknown as DriveDataFile);
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = new SyncService(mkConfig());
    await svc.save();

    // El snapshot se guardó correctamente con arrays vacíos
    const snap = localStorage.getItem('uniplanner-sync-snapshot');
    expect(snap).not.toBeNull();
    const parsed = JSON.parse(snap!);
    expect(parsed.subjectIds).toEqual([]);
    expect(parsed.taskIds).toEqual([]);
  });

  it('llama a createFile cuando findFile retorna null (primera sincronización)', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue(null);
    vi.mocked(driveService.createFile).mockResolvedValue('new-file-id');

    const svc = new SyncService(mkConfig());
    await svc.save();

    expect(vi.mocked(driveService.createFile)).toHaveBeenCalledOnce();
    const created = vi.mocked(driveService.createFile).mock.calls[0][0] as DriveDataFile;
    expect(created.userId).toBe('user-A');
  });

  it('llama a refreshToken cuando getAccessToken retorna null', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue(emptyFile());
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const refreshToken = vi.fn().mockResolvedValue('refreshed');
    const svc = new SyncService(mkConfig({ getAccessToken: () => null, refreshToken }));
    await svc.save();

    expect(refreshToken).toHaveBeenCalled();
    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalled();
  });
});

// ─── save() — manejo de errores ───────────────────────────────────────────────

describe('SyncService.save — DriveAuthError', () => {
  it('renueva el token ante DriveAuthError y reintenta con éxito', async () => {
    let calls = 0;
    vi.mocked(driveService.findFile).mockImplementation(() => {
      if (calls++ === 0) throw new DriveAuthError();
      return Promise.resolve('file-1');
    });
    vi.mocked(driveService.downloadFile).mockResolvedValue(emptyFile());
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const config = mkConfig();
    const svc = new SyncService(config);
    await svc.save();

    expect(config.refreshToken).toHaveBeenCalled();
    expect(config.onSyncSuccess).toHaveBeenCalled();
  });

  it('llama a onSyncError cuando refreshToken falla tras DriveAuthError', async () => {
    vi.mocked(driveService.findFile).mockRejectedValue(new DriveAuthError());

    const config = mkConfig({
      refreshToken: vi.fn().mockRejectedValue(new Error('sin red')),
    });
    const svc = new SyncService(config);
    await svc.save();

    expect(config.onSyncError).toHaveBeenCalledWith(expect.stringContaining('No se pudo sincronizar'));
  });
});

describe('SyncService.save — max retries exhausted', () => {
  it('agota MAX_RETRIES y llama a onSyncError con backoff', async () => {
    vi.useFakeTimers();
    vi.mocked(driveService.findFile).mockRejectedValue(new Error('network'));

    const config = mkConfig();
    const svc = new SyncService(config);

    const promise = svc.save();
    await vi.runAllTimersAsync();
    await promise;

    expect(config.onSyncError).toHaveBeenCalledWith(
      expect.stringContaining('No se pudo sincronizar'),
    );
  });
});

// ─── schedulePeriodicSync() ───────────────────────────────────────────────────

describe('SyncService.schedulePeriodicSync', () => {
  it('dispara save() en el intervalo configurado', async () => {
    vi.useFakeTimers();
    const svc = new SyncService(mkConfig());
    const saveSpy = vi.spyOn(svc, 'save').mockResolvedValue(undefined);

    const cleanup = svc.schedulePeriodicSync(200);
    await vi.advanceTimersByTimeAsync(250);

    expect(saveSpy).toHaveBeenCalled();
    cleanup();
  });

  it('cleanup detiene las invocaciones periódicas', async () => {
    vi.useFakeTimers();
    const svc = new SyncService(mkConfig());
    const saveSpy = vi.spyOn(svc, 'save').mockResolvedValue(undefined);

    const cleanup = svc.schedulePeriodicSync(200);
    cleanup();
    await vi.advanceTimersByTimeAsync(500);

    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('reemplaza el intervalo si ya había uno activo', async () => {
    vi.useFakeTimers();
    const svc = new SyncService(mkConfig());
    const saveSpy = vi.spyOn(svc, 'save').mockResolvedValue(undefined);

    const cleanup1 = svc.schedulePeriodicSync(1000);
    const cleanup2 = svc.schedulePeriodicSync(200);

    await vi.advanceTimersByTimeAsync(250);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    cleanup1();
    cleanup2();
  });
});

// ─── initialize() — ramas adicionales ────────────────────────────────────────

describe('SyncService.initialize — sin userId en archivo Drive', () => {
  it('hace pull normal cuando no hay userId pero sí hay historial local', async () => {
    await importAll({
      subjects: [{
        id: 's-local', name: 'Local', color: '#000', isActive: true,
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      }],
      tasks: [], events: [], quickNotes: [], personalLists: [],
    });

    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue({
      version: 1, exportedAt: '2026-01-01T00:00:00Z',
      // sin userId → legacy file
      subjects: [], tasks: [mkTask('t-remote')], events: [],
      quickNotes: [], personalLists: [],
    });

    const svc = new SyncService({
      getAccessToken: () => 'token',
      refreshToken: vi.fn().mockResolvedValue('token'),
      getUserId: () => 'user-A',
    });
    await svc.initialize();

    // No se limpió → updateFile no fue llamado con archivo vacío como wipe
    expect(vi.mocked(driveService.updateFile)).not.toHaveBeenCalled();
    // Pull ocurrió → tarea remota fue importada
    const snap = await exportAll();
    expect(snap.tasks.find(t => t.id === 't-remote')).toBeDefined();
  });

  it('hace pull normal cuando no hay userId, no hay historial y el lastOwner es el mismo usuario', async () => {
    localStorage.setItem('up-local-data-owner', 'user-A');

    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue({
      version: 1, exportedAt: '2026-01-01T00:00:00Z',
      subjects: [], tasks: [mkTask('t-remote')], events: [],
      quickNotes: [], personalLists: [],
    });

    const svc = new SyncService({
      getAccessToken: () => 'token',
      refreshToken: vi.fn().mockResolvedValue('token'),
      getUserId: () => 'user-A',
    });
    await svc.initialize();

    expect(vi.mocked(driveService.updateFile)).not.toHaveBeenCalled();
    const snap = await exportAll();
    expect(snap.tasks.find(t => t.id === 't-remote')).toBeDefined();
  });
});

// ─── Ramas de cobertura faltantes ────────────────────────────────────────────

describe('SyncService — ramas ?? y retornos tempranos', () => {
  it('initialize(): getUserId null → userId="" en emptyFile (rama ?? "" línea 87)', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue(null);
    vi.mocked(driveService.createFile).mockResolvedValue('new-file');

    const svc = new SyncService({
      getAccessToken: () => 'token',
      refreshToken: vi.fn().mockResolvedValue('token'),
      getUserId: () => null,
    });
    await svc.initialize();

    const created = vi.mocked(driveService.createFile).mock.calls[0][0] as DriveDataFile;
    expect(created.userId).toBe('');
  });

  it('initialize(): downloadFile retorna null → retorno temprano (línea 97)', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue(null);

    const svc = new SyncService(mkConfig());
    await expect(svc.initialize()).resolves.toBeUndefined();
    expect(vi.mocked(driveService.updateFile)).not.toHaveBeenCalled();
  });

  it('pull() privado: fileId null → retorno temprano sin llamar a downloadFile (línea 197)', async () => {
    const svc = new SyncService(mkConfig());
    // fileId comienza en null → el guard de línea 197 lo captura
    await (svc as unknown as { pull: (t: string) => Promise<void> }).pull('token');
    expect(vi.mocked(driveService.downloadFile)).not.toHaveBeenCalled();
  });

  it('pull() privado: downloadFile retorna null → retorno temprano (línea 199)', async () => {
    vi.mocked(driveService.downloadFile).mockResolvedValue(null);

    const svc = new SyncService(mkConfig());
    (svc as unknown as { fileId: string }).fileId = 'file-1';
    await (svc as unknown as { pull: (t: string) => Promise<void> }).pull('token');

    const snap = await exportAll();
    expect(snap.tasks).toHaveLength(0);
  });

  it('doSave(): getUserId null → userId="" en upload (rama ?? "" línea 235)', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue('file-1');
    vi.mocked(driveService.downloadFile).mockResolvedValue(emptyFile(''));
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = new SyncService(mkConfig({ getUserId: () => null }));
    await svc.save();

    const uploaded = vi.mocked(driveService.updateFile).mock.calls[0][1] as DriveDataFile;
    expect(uploaded.userId).toBe('');
  });
});
