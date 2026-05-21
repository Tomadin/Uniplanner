# UniPlanner

**Gestión académica y personal offline-first para estudiantes universitarios**

![Version](https://img.shields.io/badge/version-2.0.0-blue) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8)

---

## Descripción

UniPlanner es una PWA (Progressive Web App) que corre completamente en el navegador. No hay backend propio: los datos se almacenan en IndexedDB (Dexie) y se sincronizan automáticamente con Google Drive. Funciona sin conexión y puede instalarse como app en Android e iOS.

---

## Características

- **Dashboard** con estadísticas de tareas, agenda del día y próximos exámenes
- **Calendario interactivo** (FullCalendar) con soporte de recurrencias RFC 5545 (RRULE)
- **Gestión de tareas** con prioridades (5 niveles), estados, subtareas y fechas de vencimiento
- **Materias** con horario semanal, color personalizado y fecha de fin de cursado
- **Listas personales** para to-dos no académicos (compras, tareas del hogar, etc.)
- **Notas rápidas** de texto libre
- **Sincronización automática** a Google Drive cada 5 minutos + botón manual
- **Offline-first**: todo funciona sin conexión, los cambios se sincronizan al reconectar
- **PWA instalable** en Android e iOS (modo standalone)
- **Autenticación Google** con One Tap y refresh silencioso de token
- **Responsive**: diseño adaptado para desktop, tablet y móvil
- **Purga automática** de tareas completadas con más de 7 días de antigüedad

---

## Stack tecnológico

| Categoría | Tecnología |
|---|---|
| UI | React 18 + TypeScript strict |
| Base de datos local | Dexie.js (IndexedDB) |
| Estado global | Zustand |
| Data fetching / caché | TanStack React Query v5 |
| Autenticación | Google Identity Services (GIS) OAuth 2.0 |
| Sincronización | Google Drive API v3 (`appDataFolder`) |
| Calendario | FullCalendar v6 + RRule v2.8 (RFC 5545) |
| Build | Vite 5 |
| Estilos | Tailwind CSS 4 + design tokens inline |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Vitest + Testing Library + fake-indexeddb |

---

## Prerrequisitos

- **Node.js** ≥ 18 y **npm** ≥ 9
- Una **cuenta de Google**
- Un **proyecto en Google Cloud Console** con OAuth 2.0 configurado (ver sección siguiente)

---

## Configuración de Google Cloud Console

Antes de levantar el proyecto necesitás crear un Client ID de OAuth 2.0.

1. Entrá a [Google Cloud Console](https://console.cloud.google.com/) y creá un proyecto nuevo (o usá uno existente).

2. En el menú lateral, andá a **APIs y servicios → Biblioteca** y habilitá la **Google Drive API**.

3. Andá a **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo de usuario: **Externo**
   - Completá nombre de app, email de soporte y email del desarrollador
   - En **Alcances**, agregá:
     - `https://www.googleapis.com/auth/drive.appdata`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `openid`
   - En **Usuarios de prueba**, agregá tu email de Google
   - Dejá la app en modo **Testing** (no hace falta publicarla para uso personal)

4. Andá a **APIs y servicios → Credenciales → Crear credencial → ID de cliente de OAuth 2.0**:
   - Tipo de aplicación: **Aplicación web**
   - En **Orígenes de JavaScript autorizados**, agregá:
     ```
     http://localhost:5173
     ```
   - Hacé clic en **Crear** y copiá el **Client ID** generado (formato `XXXXXXX.apps.googleusercontent.com`)

---

## Instalación y levantamiento

```bash
# 1. Clonar el repositorio
git clone https://github.com/Tomadin/Uniplanner.git
cd Uniplaner

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de entorno
cp .env.example .env
```

Abrí el archivo `.env` y pegá tu Client ID:

```env
VITE_GOOGLE_CLIENT_ID=TU_CLIENT_ID.apps.googleusercontent.com
```

```bash
# 4. Levantar el servidor de desarrollo
npm run dev
```

La app estará disponible en **http://localhost:5173**.

---

## Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Client ID OAuth 2.0 de Google Cloud Console | `123456789.apps.googleusercontent.com` |

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite con hot reload |
| `npm run build` | Compilación TypeScript + bundle de producción |
| `npm run preview` | Vista previa local del build de producción |
| `npm run test` | Ejecuta la suite de tests una sola vez |
| `npm run test:watch` | Ejecuta tests en modo watch |
| `npm run test:coverage` | Genera reporte de cobertura (text + lcov) |

---

## Arquitectura

UniPlanner sigue un patrón **offline-first**: toda la lógica corre en el navegador y la sincronización con Google Drive es eventual.

```
UI (React)
    │
    ▼
Hooks de datos (useTasks, useSubjects, useEvents…)
    │  useQuery → lee de Dexie
    │  useMutation → escribe en Dexie + invalida caché
    ▼
Dexie.js (IndexedDB)
    │
    ▼ (al iniciar + cada 5 min + al recuperar foco)
SyncService ──► DriveService ──► Google Drive (uniplanner-data.json)
```

**Regla crítica de sync:** siempre descargar antes de subir.
`download → exportAll → mergeLastWriteWins → importAll → upload`

**Estrategia de merge:** Last-Write-Wins por campo `updatedAt` (ISO 8601 UTC). Las eliminaciones se detectan comparando con el snapshot del último sync exitoso.

**Retry:** backoff exponencial desde 1 s hasta 512 s (máximo 10 intentos). Los errores 401 renuevan el token silenciosamente sin contar como fallo.

### Capas principales

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Auth | `src/auth/` | GIS OAuth 2.0, token en memoria (Zustand), refresh silencioso |
| DB local | `src/db/db.ts` | Instancia Dexie, schema v1→v2, `exportAll()` / `importAll()` |
| Drive | `src/drive/DriveService.ts` | CRUD del archivo en `appDataFolder` |
| Sync | `src/sync/` | Ciclo de guardado, merge LWW, retry con backoff |
| Hooks | `src/hooks/` | React Query sobre Dexie, invalidación selectiva |
| Estado global | `src/store/`, `src/auth/authStore.ts` | Zustand: estado de sync y auth |
| UI | `src/pages/`, `src/components/` | Sin estado de datos propio; todo viene de hooks |

---

## Tests

La suite de tests cubre >90% del código usando Vitest con fake-indexeddb (no requiere un navegador real).

```bash
npm run test              # Ejecutar todos los tests
npm run test:watch        # Modo watch (útil durante desarrollo)
npm run test:coverage     # Reporte de cobertura detallado
```

**Qué se testea:**

| Archivo | Tipo | Cobertura |
|---|---|---|
| `src/utils/date.test.ts` | Unitario | Helpers de fechas |
| `src/db/db.test.ts` | Integración | Import/export, purga, limpieza |
| `src/auth/authStore.test.ts` | Unitario | Zustand store de auth |
| `src/sync/mergeLastWriteWins.test.ts` | Unitario | Estrategia LWW + detección de eliminaciones |
| `src/sync/SyncService.test.ts` | Integración | Init, save, retry, token refresh |
| `src/hooks/useTasks.test.tsx` | Integración React | CRUD de tareas |
| `src/hooks/useSubjects.test.tsx` | Integración React | CRUD de materias |
| `src/tests/userIsolation.test.ts` | Integración | Aislamiento por cuenta de Google |

---

## Deploy

La app está desplegada en producción en **Vercel**. Vercel detecta automáticamente proyectos Vite y configura el routing SPA sin pasos adicionales.

Para generar el build de producción localmente:

```bash
npm run build    # Genera la carpeta /dist
npm run preview  # Vista previa local en http://localhost:4173
```
