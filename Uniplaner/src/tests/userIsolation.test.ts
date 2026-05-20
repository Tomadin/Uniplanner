import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportAll, importAll, clearLocalData } from '../db/db';
import { SyncService } from '../sync/SyncService';
import { useAuthStore } from '../auth/authStore';
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
    constructor() { super('401'); }
  },
}));

// Importar DESPUÉS del mock para obtener las funciones espiadas
const { driveService } = await import('../drive/DriveService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mkTask(id: string): Task {
  return {
    id, subjectId: null, parentTaskId: null, title: 'T',
    description: null, priority: 'MEDIUM', status: 'NOT_STARTED',
    dueDate: null, completedAt: null, observations: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  };
}

function mkDriveFile(userId: string, extra: Partial<DriveDataFile> = {}): DriveDataFile {
  return {
    version: 1, exportedAt: '2026-01-01T00:00:00Z', userId,
    subjects: [], tasks: [], events: [], quickNotes: [], personalLists: [],
    ...extra,
  };
}

function mkSyncService(userId: string): SyncService {
  return new SyncService({
    getAccessToken: () => 'fake-token',
    refreshToken:   () => Promise.resolve('fake-token'),
    getUserId:      () => userId,
  });
}

beforeEach(async () => {
  vi.resetAllMocks();
  await clearLocalData();
  localStorage.clear();
  useAuthStore.getState().clearAuth();
});

// ─── Tests de aislamiento de DB ───────────────────────────────────────────────

describe('aislamiento de datos — DB', () => {
  it('después de clearLocalData la DB queda completamente vacía', async () => {
    await importAll({
      subjects: [], tasks: [mkTask('t1')], events: [],
      quickNotes: [], personalLists: [],
    });
    await clearLocalData();
    const snap = await exportAll();
    expect(Object.values(snap).every(arr => arr.length === 0)).toBe(true);
  });

  it('datos de usuario A no son visibles después de clearLocalData', async () => {
    await importAll({
      subjects: [], tasks: [mkTask('user-a-task')], events: [],
      quickNotes: [], personalLists: [],
    });
    await clearLocalData();
    const snap = await exportAll();
    expect(snap.tasks.find(t => t.id === 'user-a-task')).toBeUndefined();
  });
});

// ─── Tests de SyncService.initialize() ───────────────────────────────────────

describe('SyncService.initialize — detección de userId distinto', () => {
  it('borra datos locales cuando Drive tiene userId diferente al actual', async () => {
    // Usuario A tiene datos locales
    await importAll({
      subjects: [], tasks: [mkTask('task-a')], events: [],
      quickNotes: [], personalLists: [],
    });

    // Drive devuelve un archivo que pertenece al usuario B
    vi.mocked(driveService.findFile).mockResolvedValue('file-123');
    vi.mocked(driveService.downloadFile).mockResolvedValue(
      mkDriveFile('user-B', { tasks: [mkTask('task-b')] }),
    );
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = mkSyncService('user-A');
    await svc.initialize();

    const snap = await exportAll();
    expect(snap.tasks).toHaveLength(0);
  });

  it('llama a updateFile con userId del usuario actual y datos vacíos cuando hay contaminación', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue('file-123');
    vi.mocked(driveService.downloadFile).mockResolvedValue(
      mkDriveFile('user-B', { tasks: [mkTask('task-b')] }),
    );
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = mkSyncService('user-A');
    await svc.initialize();

    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalledOnce();
    const uploadedData = vi.mocked(driveService.updateFile).mock.calls[0][1] as DriveDataFile;
    expect(uploadedData.userId).toBe('user-A');
    expect(uploadedData.tasks).toHaveLength(0);
    expect(uploadedData.subjects).toHaveLength(0);
  });

  it('NO borra datos locales cuando Drive tiene el userId correcto', async () => {
    const remoteTask = mkTask('task-from-drive');
    vi.mocked(driveService.findFile).mockResolvedValue('file-123');
    vi.mocked(driveService.downloadFile).mockResolvedValue(
      mkDriveFile('user-A', { tasks: [remoteTask] }),
    );
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = mkSyncService('user-A');
    await svc.initialize();

    const snap = await exportAll();
    expect(snap.tasks.find(t => t.id === 'task-from-drive')).toBeDefined();
  });
});

describe('SyncService.initialize — sin userId en archivo Drive', () => {
  it('limpia datos cuando no hay userId, no hay historial local y el lastOwner es diferente', async () => {
    localStorage.setItem('up-local-data-owner', 'user-B');

    const remoteFile: DriveDataFile = {
      version: 1, exportedAt: '2026-01-01T00:00:00Z',
      subjects: [], tasks: [mkTask('remote-task')], events: [],
      quickNotes: [], personalLists: [],
    };
    vi.mocked(driveService.findFile).mockResolvedValue('file-123');
    vi.mocked(driveService.downloadFile).mockResolvedValue(remoteFile);
    vi.mocked(driveService.updateFile).mockResolvedValue(undefined);

    const svc = mkSyncService('user-A');
    await svc.initialize();

    const snap = await exportAll();
    expect(snap.tasks).toHaveLength(0);
    expect(vi.mocked(driveService.updateFile)).toHaveBeenCalledOnce();
  });

  it('crea archivo vacío cuando no existe en Drive', async () => {
    vi.mocked(driveService.findFile).mockResolvedValue(null);
    vi.mocked(driveService.createFile).mockResolvedValue('new-file-id');

    const svc = mkSyncService('user-A');
    await svc.initialize();

    expect(vi.mocked(driveService.createFile)).toHaveBeenCalledOnce();
    const createdData = vi.mocked(driveService.createFile).mock.calls[0][0] as DriveDataFile;
    expect(createdData.userId).toBe('user-A');
    expect(createdData.tasks).toHaveLength(0);
  });
});
