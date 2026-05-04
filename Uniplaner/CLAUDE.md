# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Servidor de desarrollo Vite en http://localhost:5173
npm run build      # tsc + vite build (TypeScript primero, luego bundle)
npm run preview    # Previsualizar el build de producción

npx tsc --noEmit   # Verificar tipos sin compilar (usar antes de cada commit)
```

No hay test runner configurado aún (RNF-06 pendiente, cobertura mínima objetivo 70%).

## Architecture

PWA offline-first sin backend. Toda la lógica corre en el navegador.

### Flujo de datos

```
UI (React) → mutation hook → Dexie.js (IndexedDB) → React Query invalida cache → UI re-renderiza
                                        ↕  (al iniciar y cada 5 min)
                               SyncService ↔ Google Drive (uniplanner-data.json)
```

La regla crítica de sync es **siempre descargar antes de subir**: `download → exportAll → mergeLastWriteWins → importAll → upload`. Nunca serializar Dexie directamente a Drive sin mergear primero (sobreescribiría cambios de otros dispositivos).

### Capas principales

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Auth | `src/auth/GoogleAuthProvider.tsx`, `src/auth/authStore.ts` | GIS OAuth 2.0, token en memoria (Zustand), refresh silencioso |
| DB local | `src/db/db.ts` | Instancia Dexie, schema, `exportAll()` / `importAll()` |
| Drive | `src/drive/DriveService.ts` | CRUD del archivo `uniplanner-data.json` en `appDataFolder` |
| Sync | `src/sync/SyncService.ts`, `src/sync/mergeLastWriteWins.ts` | Ciclo de guardado, retry con backoff exponencial (1s→512s, máx 10), refresh de token en mid-save |
| Hooks de datos | `src/hooks/use*.ts` | `useQuery` → lee Dexie; `useMutation` → escribe Dexie + invalida cache |
| Estado global | `src/store/syncStore.ts`, `src/auth/authStore.ts` | Zustand: estado de sync y auth |
| UI | `src/pages/`, `src/components/` | Sin estado de datos propio; todo viene de hooks |

### Patrones invariantes

**Mutations**: siempre incluir `onSuccess: () => qc.invalidateQueries(...)` y `onError: (err) => console.error(...)`. Sin `onError`, los fallos de Dexie son silenciosos.

**Sync e invalidación**: después de que `SyncService.initialize()` o `save()` llaman a `importAll()`, el hook `useSync` debe llamar `qc.invalidateQueries()` para que React Query refleje los cambios en Dexie. Esto ocurre en `useSync.ts`.

**IDs**: siempre generados en cliente con `crypto.randomUUID()` (ver `src/utils/uuid.ts`). El campo `updatedAt` (ISO 8601) es el árbitro del merge Last-Write-Wins.

**Token Google**: dura 1 hora. El `SyncService` atrapa `DriveAuthError` (HTTP 401) y llama a `refreshTokenSilently()` antes de reintentar, sin contar el reintento como fallo.

### Sistema de diseño

Todos los estilos son **inline styles** usando el objeto `T` de `src/design/tokens.ts`. No usar clases Tailwind en componentes (Tailwind está configurado pero reservado para utilidades globales en `index.css`). Fuentes: Fraunces (display/títulos), Instrument Sans (UI), JetBrains Mono (monospace).

### Routing

No hay router de páginas. La navegación es un estado `route` en `App.tsx` que renderiza condicionalmente. Layout desktop = `Sidebar` + contenido; layout mobile (< 768 px) = `BottomNav` + contenido.

## Configuración requerida

El archivo `.env` (ignorado por git) debe tener:
```
VITE_GOOGLE_CLIENT_ID=<client_id>.apps.googleusercontent.com
```

El OAuth client ID se configura en Google Cloud Console con:
- Scopes: `drive.appdata`, `userinfo.profile`, `openid`
- La app debe estar en modo "Testing" con el email del usuario agregado como test user hasta publicarla.

## Fases pendientes

- **Fase 5**: Service Worker (`vite-plugin-pwa`), detección de offline, PWA manifest, instalación en Android.
- **Fase 6**: CI/CD con GitHub Actions, deploy a Netlify/Vercel, tests unitarios.
