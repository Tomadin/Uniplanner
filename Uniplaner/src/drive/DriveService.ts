import type { DriveDataFile } from '../types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const API_BASE    = 'https://www.googleapis.com/drive/v3';
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const FILENAME    = 'uniplanner-data.json';
const PARENT      = 'appDataFolder';

// ─── Errores tipados ──────────────────────────────────────────────────────────

export class DriveError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = 'DriveError';
  }
}

// Señal específica para renovación de token (sec. 3.6)
export class DriveAuthError extends DriveError {
  constructor() {
    super('Drive: token inválido (401)', 401);
    this.name = 'DriveAuthError';
  }
}

// ─── Helper de request ────────────────────────────────────────────────────────

async function request<T>(
  url: string,
  options: RequestInit,
  accessToken: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) throw new DriveAuthError();
  if (!res.ok) {
    throw new DriveError(
      `Drive API ${res.status}: ${res.statusText}`,
      res.status,
    );
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

// ─── Helper multipart/related (para files.create) ─────────────────────────────

function buildMultipart(
  metadata: Record<string, unknown>,
  content: string,
): { body: Blob; contentType: string } {
  const boundary = `up_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const parts = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  return {
    body: new Blob([parts]),
    contentType: `multipart/related; boundary="${boundary}"`,
  };
}

// ─── Drive Service (sec. 5.2) ─────────────────────────────────────────────────

export const driveService = {
  /** Busca el archivo del usuario en appDataFolder. Retorna el fileId o null. */
  async findFile(accessToken: string): Promise<string | null> {
    const params = new URLSearchParams({
      q: `name='${FILENAME}'`,
      spaces: PARENT,
      fields: 'files(id,name)',
    });
    const result = await request<{ files: Array<{ id: string }> }>(
      `${API_BASE}/files?${params}`,
      { method: 'GET' },
      accessToken,
    );
    return result.files?.[0]?.id ?? null;
  },

  /** Descarga y parsea el JSON completo desde Drive. */
  async downloadFile(
    fileId: string,
    accessToken: string,
  ): Promise<DriveDataFile | null> {
    const result = await request<DriveDataFile>(
      `${API_BASE}/files/${fileId}?alt=media`,
      { method: 'GET' },
      accessToken,
    );
    return result ?? null;
  },

  /** Crea el archivo por primera vez en appDataFolder. Retorna el fileId. */
  async createFile(
    data: DriveDataFile,
    accessToken: string,
  ): Promise<string> {
    const metadata = {
      name: FILENAME,
      parents: [PARENT],
      mimeType: 'application/json',
    };
    const { body, contentType } = buildMultipart(metadata, JSON.stringify(data));

    const result = await request<{ id: string }>(
      `${UPLOAD_BASE}/files?uploadType=multipart`,
      { method: 'POST', body, headers: { 'Content-Type': contentType } },
      accessToken,
    );
    return result.id;
  },

  /** Sobreescribe el contenido del archivo existente. */
  async updateFile(
    fileId: string,
    data: DriveDataFile,
    accessToken: string,
  ): Promise<void> {
    await request<void>(
      `${UPLOAD_BASE}/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      },
      accessToken,
    );
  },
};

export type DriveServiceType = typeof driveService;
