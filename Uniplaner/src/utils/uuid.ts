/** Genera un UUID v4 usando la API nativa del navegador. */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Genera una fecha ISO 8601 para `createdAt` / `updatedAt`. */
export function nowIso(): string {
  return new Date().toISOString();
}
