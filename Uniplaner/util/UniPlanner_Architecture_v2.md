|<p>**UniPlanner**</p><p>Sistema de Gestion Academica y Personal</p><p>*Documento de Arquitectura, Diseno y Especificacion Tecnica*</p>|
| :-: |

|Autor|Brian Tomadin|
| :- | :- |
|Version|2\.0.0 — MVP (Sin Backend)|
|Fecha|Abril 2026|
|Estado|Arquitectura Revisada — Lista para Desarrollo|

|<p>**Cambio principal respecto a v1.0**</p><p>Se elimina el backend (Spring Boot + PostgreSQL + VPS). La capa de datos pasa a ser Google Drive como almacenamiento remoto y Dexie.js (IndexedDB) como base de datos local. La autenticacion se delega a Google OAuth 2.0. El costo operacional es cero.</p>|
| :- |


# **1. Descripcion del Proyecto**
UniPlanner es una aplicacion web progresiva (PWA) de gestion academica y personal disenada para estudiantes universitarios. Provee un espacio de trabajo unificado donde el usuario organiza sus materias, tareas, calendario y notas desde un solo lugar, con capacidad de operacion offline ante conectividad intermitente.

El sistema esta disenado para uso privado de dos usuarios con espacios de trabajo completamente aislados, sin ninguna funcionalidad colaborativa en la version 1.0. No existe backend propio: los datos de cada usuario residen en su propia cuenta de Google Drive y en el IndexedDB local del navegador.

|<p>**Motivacion**</p><p>Las herramientas existentes como Notion resultan sobredimensionadas para uso academico cotidiano, Google Calendar no soporta el concepto de materias universitarias, y Obsidian carece de sincronizacion sencilla entre dispositivos. UniPlanner cubre ese espacio: simple, enfocado y completamente offline-capable. La eliminacion del backend propio reduce el costo y la complejidad operacional a cero.</p>|
| :- |

## **1.1 Objetivos**
- Proveer una unica interfaz para gestionar tareas academicas, generales, calendario y notas.
- Funcionar correctamente sin conexion a internet por periodos prolongados.
- Ser usable sin curva de aprendizaje para usuarios no tecnicos.
- Servir como proyecto de portfolio profesional y herramienta de aprendizaje de React + PWA.
- Costo operacional cero: sin servidor propio, sin mantenimiento de infraestructura.

## **1.2 Usuarios Objetivo**

|**Usuario**|**Perfil**|**Dispositivos**|
| :-: | :-: | :-: |
|Brian|Desarrollador, estudiante universitario|PC + Android|
|Paula|Estudiante de medicina, 3 anio UNCuyo|Android (conectividad intermitente)|

# **2. Features del Sistema**
## **2.1 Modulo de Tareas**
- Tareas generales (sin materia asociada) y tareas por materia.
- Subtareas recursivas de N niveles.
- Fecha limite opcional por tarea.
- Estados: Sin Iniciar, En Progreso, Completada, Cancelada.
- Prioridad configurable: Ninguna, Baja, Media, Alta, Urgente.
- Campo de observaciones libre por tarea.
- Boton de completar rapido desde la vista de tabla.
- Limpieza automatica: tareas Completadas se eliminan a los 7 dias (logica en cliente).

## **2.2 Modulo Academico (Materias)**
- Alta, baja y modificacion de materias con nombre y color identificatorio.
- Cada materia agrupa sus propias tareas.
- Registro de examenes por materia con fecha, hora y descripcion.
- Los examenes aparecen automaticamente en el calendario con indicador visual diferenciado.
- Estado activo/inactivo por materia para cuatrimestres anteriores.

## **2.3 Calendario**
- Vistas por dia, semana y mes.
- Eventos generales y eventos asociados a materia.
- Soporte para eventos recurrentes mediante estandar iCal RRULE (diario, semanal, mensual).
- Los examenes de materias se visualizan en el calendario con badge diferenciado.
- Las tareas con fecha limite se muestran como indicadores en el calendario.

## **2.4 Vista de Tabla de Tareas**
- Vista tabular de todas las tareas del usuario en una sola pantalla.
- Columnas: Tarea, Materia, Prioridad, Fecha Limite, Estado, Observaciones, Accion.
- Edicion inline de celdas (prioridad, estado, observaciones, fecha).
- Filtros por materia, estado y prioridad.
- Implementada con TanStack Table.

## **2.5 Dashboard**
- Tareas proximas a vencer (proximos 7 dias) ordenadas por prioridad.
- Examenes proximos (proximos 30 dias) con materia y fecha.
- Eventos del dia actual.
- Contador de tareas vencidas sin completar.
- Seccion de Notas Rapidas: captura inmediata de texto, sin estructura.

## **2.6 Operacion Offline (PWA)**
- Toda la informacion del usuario se almacena localmente en IndexedDB (Dexie.js).
- La aplicacion funciona completamente sin conexion.
- Al recuperar conectividad, los datos se sincronizan con Google Drive automaticamente.
- Instalable en el homescreen de Android sin necesidad de Play Store.

# **3. Arquitectura del Sistema**
## **3.1 Vista General**

|<p>**Arquitectura sin backend propio**</p><p>UniPlanner es una SPA/PWA que corre enteramente en el navegador del usuario. No existe servidor de aplicacion ni base de datos propia. Los datos residen en dos lugares: IndexedDB local (Dexie.js) para acceso rapido y offline, y un archivo JSON en Google Drive del usuario como fuente de verdad remota. La autenticacion es delegada completamente a Google OAuth 2.0.</p>|
| :- |

|**Capa**|**Tecnologia**|
| :-: | :-: |
|Frontend Web / PWA|React 18 + TypeScript + Vite|
|Estado local / Offline DB|IndexedDB via Dexie.js|
|Sincronizacion remota|Google Drive API v3 (appDataFolder)|
|Autenticacion|Google Identity Services (OAuth 2.0)|
|Limpieza automatica|Logica en cliente al iniciar sesion|
|Deploy|GitHub Pages / Netlify / Vercel (estatico)|

## **3.2 Diagrama de Componentes**

|<p>**React PWA (Browser)**</p><p>`  `[ Dashboard | Calendar | Tasks | Subjects ]</p><p>`  `[ TanStack Query <-> Dexie.js (IndexedDB) ]</p><p>`  `[ Google Identity Services (OAuth) ]</p><p>`  `[ Drive Sync Service ]</p><p>`  `*|  HTTPS / Google Drive API v3 (appDataFolder)*</p><p>`  `[ Google Drive ]</p><p>`  `[ uniplanner-data.json ]  <- fuente de verdad remota</p>|
| :- |

## **3.3 Flujo de Sincronizacion**

|**Momento**|**Accion**|
| :-: | :-: |
|App inicia / usuario loguea|Descarga uniplanner-data.json de Drive → carga en Dexie.js|
|Usuario trabaja|Operaciones CRUD directamente sobre Dexie.js (rapido, sin red)|
|Cada 5 minutos / app cierra|Ejecuta DriveService.save() — ver patron correcto abajo|
|App inicia offline|Usa Dexie.js local directamente, sin intentar Drive|
|Reconecta estando activo|Ejecuta DriveService.save() — descarga, mergea y sube|

## **3.4 Patron correcto de escritura en Drive (CRITICO)**

|<p>**Error comun a evitar**</p><p>La operacion de guardado NO es "serializar Dexie y subir". Eso sobreescribe cambios hechos en otros dispositivos que esten abiertos al mismo tiempo. El patron correcto es siempre descargar primero, mergear, y luego subir.</p>|
| :- |

|<p>// DriveService.save() — patron obligatorio</p><p>async function save() {</p><p>`  `const remoto  = await Drive.download();  // 1. descargar</p><p>`  `const local   = await Dexie.exportAll(); // 2. leer local</p><p>`  `const merged  = mergeLastWriteWins(remoto, local); // 3. mergear</p><p>`  `await Dexie.importAll(merged);           // 4. actualizar local</p><p>`  `await Drive.upload(merged);              // 5. subir resultado</p><p>}</p>|
| :- |

La funcion mergeLastWriteWins recorre cada coleccion (subjects, tasks, events, quickNotes) y para cada entidad con el mismo id compara el campo updatedAt. Gana el objeto con timestamp mas reciente. Las entidades que existen solo en uno de los dos lados se incluyen directamente sin conflicto.

## **3.5 Manejo de errores de sincronizacion**
Cuando DriveService.save() falla (sin conexion, token vencido, error de red), el sistema aplica la siguiente estrategia:

|**Etapa**|**Comportamiento**|
| :-: | :-: |
|Reintentos automaticos|Hasta 10 reintentos con backoff exponencial (1s, 2s, 4s... hasta 512s). El usuario no ve nada durante los reintentos.|
|Tras 10 fallos consecutivos|Se muestra un banner persistente en la UI: "No se pudo sincronizar. Tus datos estan guardados localmente." con un boton "Reintentar ahora".|
|Boton Reintentar|El usuario puede forzar un nuevo ciclo de save() manualmente en cualquier momento desde el banner o desde Ajustes.|
|Datos nunca se pierden|Dexie.js siempre tiene el estado local completo. El fallo de sync no afecta la operacion de la app ni la posibilidad de seguir trabajando offline.|

## **3.6 Token de acceso de Google (Refresh)**
El access token de Google Identity Services tiene una duracion de 1 hora. Vencido el token, cualquier llamada a Drive API devuelve 401. El manejo es el siguiente:

|**Caso**|**Comportamiento**|
| :-: | :-: |
|Token vigente|DriveService usa el token en memoria directamente.|
|Token vencido, sesion Google activa|GIS renueva el token silenciosamente sin interaccion del usuario. Transparente para la app.|
|Token vencido, sin sesion Google|DriveService recibe 401, marca el estado como "requiere login" y muestra el boton de login de Google. Los datos locales siguen accesibles.|
|Drive API devuelve 401 en mid-save|Se interrumpe el ciclo de save, se intenta renovar el token, y se reintenta el save completo desde el paso 1 (descarga).|

## **3.7 Alcance del appDataFolder de Google Drive**

|<p>**Por que appDataFolder y no Drive normal (scope minimo)**</p><p>El scope https://www.googleapis.com/auth/drive.appdata permite que la app lea y escriba una carpeta oculta en Google Drive del usuario (Application Data). El usuario no ve ni puede editar ese archivo manualmente, lo que previene corrupcion accidental de datos. El alcance es minimo y no requiere acceso al Drive completo del usuario.</p>|
| :- |

# **4. Esquema de Datos**
No existe base de datos relacional. Los datos se modelan como objetos JavaScript almacenados en IndexedDB via Dexie.js y serializados a JSON para Drive. El esquema es identico en ambos lugares.

## **4.1 Schema Dexie.js**

|<p>const db = new Dexie('UniPlanner');</p><p>db.version(1).stores({</p><p>`  `subjects: '&id, isActive, updatedAt',</p><p>`  `tasks:    '&id, subjectId, parentTaskId, status, dueDate, updatedAt',</p><p>`  `events:   '&id, subjectId, startTime, isExam, updatedAt',</p><p>`  `quickNotes: '&id, updatedAt',</p><p>});</p>|
| :- |

## **4.2 Entidades**
## **subjects**

|**Campo**|**Tipo**|**Descripcion**|
| :-: | :-: | :-: |
|id|string (UUID)|PK, generado en cliente|
|name|string|Nombre de la materia|
|color|string|Hex color para UI (#FF5733)|
|isActive|boolean|false = cuatrimestre anterior|
|createdAt|string (ISO)|Fecha de creacion|
|updatedAt|string (ISO)|Para Last-Write-Wins|

## **tasks**

|**Campo**|**Tipo**|**Descripcion**|
| :-: | :-: | :-: |
|id|string (UUID)|PK|
|subjectId|string | null|FK logica a subjects. null = tarea general|
|parentTaskId|string | null|FK logica a tasks. null = tarea raiz|
|title|string|Titulo de la tarea|
|description|string | null|Descripcion opcional|
|priority|string enum|NONE | LOW | MEDIUM | HIGH | URGENT|
|status|string enum|NOT\_STARTED | IN\_PROGRESS | COMPLETED | CANCELLED|
|dueDate|string | null|Fecha limite ISO opcional|
|completedAt|string | null|Para calcular limpieza de 7 dias|
|observations|string | null|Campo libre|
|createdAt|string (ISO)|Fecha de creacion|
|updatedAt|string (ISO)|Para Last-Write-Wins|

## **events**

|**Campo**|**Tipo**|**Descripcion**|
| :-: | :-: | :-: |
|id|string (UUID)|PK|
|subjectId|string | null|FK logica a subjects. null = evento general|
|title|string|Titulo del evento|
|startTime|string (ISO)|Inicio del evento|
|endTime|string (ISO)|Fin del evento|
|isExam|boolean|true = badge especial en calendario|
|recurrenceRule|string | null|RRULE iCal. null = evento unico|
|recurrenceEndDate|string | null|Limite de recurrencia ISO|
|updatedAt|string (ISO)|Para Last-Write-Wins|

# **5. Integracion con Google**
## **5.1 Autenticacion (Google Identity Services)**
No existe endpoint de login propio. La autenticacion se realiza con la libreria oficial de Google Identity Services (GIS). El token de acceso de Google se usa directamente para llamar a la Drive API.

|<p>// Scopes requeridos</p><p>'https://www.googleapis.com/auth/drive.appdata'</p><p>'https://www.googleapis.com/auth/userinfo.profile'</p><p>'openid'</p>|
| :- |

## **5.2 Drive API — Operaciones**

|**Operacion**|**Drive API**|**Descripcion**|
| :-: | :-: | :-: |
|Buscar archivo|files.list + q=name=uniplanner-data.json|Al iniciar, busca el archivo del usuario|
|Crear archivo|files.create (multipart)|Primera vez que el usuario usa la app|
|Leer datos|files.get?alt=media|Descarga el JSON completo|
|Guardar datos|files.update (multipart)|Sube el JSON actualizado|

## **5.3 Estructura del archivo en Drive**

|<p>{</p><p>`  `"version": 1,</p><p>`  `"exportedAt": "2026-04-11T12:00:00Z",</p><p>`  `"subjects":  [ ... ],</p><p>`  `"tasks":     [ ... ],</p><p>`  `"events":    [ ... ],</p><p>`  `"quickNotes": [ ... ]</p><p>}</p>|
| :- |

# **6. Decisiones Tecnicas y Justificaciones**
## **6.1 Sin backend propio**

|<p>**Decision**</p><p>Se elimina Spring Boot, PostgreSQL y VPS. No existe servidor de aplicacion propio.</p>|
| :- |

Justificacion: El sistema tiene 2 usuarios con datos completamente privados y sin interaccion entre ellos. Un backend agrega costo operacional mensual, complejidad de deploy, mantenimiento de certificados SSL, gestion de base de datos y un punto de falla adicional. Ninguno de estos costos genera valor para el caso de uso actual. Google Drive resuelve el problema de sincronizacion entre dispositivos sin requerir infraestructura propia.

## **6.2 Google Drive como capa de sincronizacion**

|<p>**Decision**</p><p>Un unico archivo JSON por usuario en appDataFolder de Google Drive actua como fuente de verdad remota.</p>|
| :- |

Justificacion: Google Drive provee almacenamiento gratuito, redundancia, autenticacion integrada y acceso desde cualquier dispositivo sin necesidad de infraestructura propia. El scope appDataFolder es minimo (no requiere acceso al Drive completo) y oculta el archivo del usuario para evitar edicion accidental. Para 2 usuarios con datos de pocas KB, el modelo de archivo unico es correcto y simple.

## **6.3 Dexie.js como base de datos local**

|<p>**Decision**</p><p>IndexedDB via Dexie.js es la capa de acceso a datos en tiempo real. Drive es solo para persistencia entre dispositivos.</p>|
| :- |

Justificacion: Las operaciones CRUD van contra Dexie.js (sincronas desde la perspectiva del usuario), eliminando latencia de red en uso normal. Drive se consulta solo al iniciar y se actualiza periodicamente en segundo plano. Esto garantiza operacion offline completa y una UX rapida independientemente de la conexion.

## **6.4 Estrategia de conflictos: Last-Write-Wins**

|<p>**Decision**</p><p>Conflictos de sincronizacion se resuelven por campo updatedAt. El ultimo en escribir gana.</p>|
| :- |

Justificacion: Los espacios de trabajo son completamente privados. La probabilidad de que Brian edite la misma tarea desde PC y Android simultaneamente sin conexion es extremadamente baja. CRDTs son complejidad injustificada para este caso. Si ocurre un conflicto, se pierde como maximo una edicion reciente de baja probabilidad.

## **6.5 PWA sobre App Nativa**

|<p>**Decision**</p><p>Progressive Web App instalable en Android. No se desarrolla app nativa.</p>|
| :- |

Justificacion: Ambos usuarios utilizan Android, donde la PWA tiene soporte completo. Elimina la necesidad de mantener dos codebases. Evita el proceso de publicacion en Play Store. El costo en UX es imperceptible en uso diario.

## **6.6 Deploy estatico (sin servidor)**

|<p>**Decision**</p><p>La aplicacion se deploya como sitio estatico en GitHub Pages, Netlify o Vercel. Costo: $0.</p>|
| :- |

Justificacion: Al no haber backend, no existe API que servir. El frontend compilado es un conjunto de archivos estaticos que pueden ser hosteados gratuitamente. El deploy se reduce a un push a main con CI/CD automatico.

## **6.7 Subtareas Recursivas con referencia logica**

|<p>**Decision**</p><p>Campo parentTaskId en el objeto task apuntando a otra task. Sin JOIN ni tabla separada.</p>|
| :- |

Justificacion: En un modelo de datos en memoria/JSON, la relacion padre-hijo se navega en cliente filtrando por parentTaskId. Permite N niveles de profundidad sin cambios de schema.

## **6.8 Recurrencia con RRULE iCal**

|<p>**Decision**</p><p>Las reglas de recurrencia de eventos se almacenan como strings RRULE en formato iCal estandar.</p>|
| :- |

Justificacion: No reinventar un estandar maduro. rrule.js en el frontend parsea y expande las recurrencias para mostrarlas en el calendario. Ejemplo: FREQ=WEEKLY;BYDAY=MO,WE para cada lunes y miercoles.

# **7. Requisitos**
## **7.1 Requisitos Funcionales**

|**ID**|**Descripcion**|
| :-: | :-: |
|RF-01|El usuario debe autenticarse con su cuenta de Google (OAuth 2.0).|
|RF-02|Cada usuario debe tener datos completamente aislados en su propia cuenta de Drive.|
|RF-03|El usuario debe poder crear, editar y eliminar materias con nombre y color.|
|RF-04|Las tareas pueden ser generales o estar asociadas a una materia.|
|RF-05|Las tareas soportan subtareas de forma recursiva sin limite de profundidad.|
|RF-06|Las tareas tienen fecha limite opcional, prioridad y estado.|
|RF-07|Las tareas completadas deben eliminarse automaticamente a los 7 dias (logica en cliente).|
|RF-08|El calendario debe mostrar eventos propios, eventos de materias y examenes.|
|RF-09|Los eventos pueden ser unicos o recurrentes (RRULE iCal).|
|RF-10|Los examenes registrados en una materia deben aparecer en el calendario.|
|RF-11|La vista de tabla debe mostrar todas las tareas con edicion inline.|
|RF-12|El dashboard debe mostrar tareas proximas, examenes proximos y eventos del dia.|
|RF-13|La aplicacion debe funcionar sin conexion a internet.|
|RF-14|Los cambios locales deben sincronizarse con Google Drive al recuperar conexion.|
|RF-15|Los datos deben ser accesibles desde cualquier dispositivo del mismo usuario.|

## **7.2 Requisitos No Funcionales**

|**ID**|**Descripcion**|
| :-: | :-: |
|RNF-01|La aplicacion debe ser instalable como PWA en dispositivos Android.|
|RNF-02|Las operaciones CRUD locales no deben superar 50ms (Dexie.js sobre IndexedDB).|
|RNF-03|La sincronizacion con Drive debe realizarse en segundo plano sin bloquear la UI.|
|RNF-04|El deploy debe completarse automaticamente con un push a la rama main.|
|RNF-05|El costo operacional mensual debe ser cero.|
|RNF-06|El codigo debe incluir tests unitarios para la logica de negocio (minimo 70%).|

## **7.3 Requisitos de Infraestructura**

|**Componente**|**Detalle**|
| :-: | :-: |
|Hosting|GitHub Pages / Netlify / Vercel (estatico, gratuito)|
|Dominio|Subdominio gratuito de Netlify/Vercel o dominio propio ($10/anio)|
|Google Cloud|Proyecto con Drive API habilitada y OAuth 2.0 configurado (gratuito para esta escala)|
|CI/CD|GitHub Actions para build y deploy automatico|

# **8. Limites y Exclusiones (v1.0)**

|<p>**Importante**</p><p>Las siguientes funcionalidades estan explicitamente fuera del scope de la version 1.0. Su ausencia es una decision deliberada, no una limitacion tecnica.</p>|
| :- |

|**Excluido**|**Razon**|
| :-: | :-: |
|Funcionalidad colaborativa|Los espacios de trabajo son privados. Reservado para v2.0.|
|Tareas / calendarios compartidos|No existe caso de uso en v1.0.|
|App nativa iOS / Android|La PWA cubre el caso de uso en Android.|
|Notificaciones push avanzadas|Pueden agregarse sobre la PWA existente sin rediseno.|
|Adjuntos / archivos por tarea|Requeriria Drive File API adicional. Reservado para v2.0.|
|Backend Spring Boot|Eliminado. Sin caso de uso que lo justifique para 2 usuarios.|
|PostgreSQL / base de datos relacional|Reemplazado por Dexie.js + JSON en Drive.|
|VPS / Docker / Nginx|Eliminados. El deploy es estatico.|
|Redis / cache|Innecesario. Sin backend que cachear.|

# **9. Plan de Desarrollo**

|<p>**Nota**</p><p>Los tiempos son estimaciones para un desarrollador trabajando en paralelo con universidad y trabajo. Se recomienda no comprometer features hasta tener la fase anterior en uso real.</p>|
| :- |

|**Fase**|**Tiempo Est.**|**Entregable**|**Contenido**|
| :-: | :-: | :-: | :-: |
|Fase 1|1 semana|Auth + Drive Base|Google OAuth con GIS, lectura/escritura de JSON en appDataFolder, inicializacion de Dexie.js desde Drive.|
|Fase 2|1-2 semanas|Frontend Base|React + TS + Vite, rutas, layout, CRUD de materias y tareas contra Dexie.js.|
|Fase 3|1-2 semanas|Calendario|FullCalendar, eventos, examenes, recurrencia con rrule.js.|
|Fase 4|1-2 semanas|Tabla + Dashboard|TanStack Table con edicion inline, dashboard agregado.|
|Fase 5|1-2 semanas|Offline + Sync|Service Worker, deteccion de conectividad, logica de merge Last-Write-Wins, sincronizacion automatica en background.|
|Fase 6|1 semana|Deploy + QA|GitHub Actions, deploy a Netlify/Vercel, tests, PWA manifest, instalacion en Android.|

**Tiempo total estimado: 3 a 4 meses trabajando de forma consistente. La eliminacion del backend ahorra aproximadamente 1 mes respecto a la v1.0.**

# **10. Estructura de Proyecto**
## **10.1 Frontend (React + TypeScript)**

|<p>src/</p><p>`  `auth/        <- GoogleAuthProvider, useAuth hook</p><p>`  `drive/       <- DriveService (upload/download JSON)</p><p>`  `db/          <- Dexie.js schema, tablas, operaciones</p><p>`  `sync/        <- SyncService, merge LWW, deteccion offline</p><p>`  `components/  <- Componentes reutilizables</p><p>`  `pages/       <- Dashboard, Calendar, Tasks, Subjects</p><p>`  `hooks/       <- useTasks, useSubjects, useSync, useOffline</p><p>`  `store/       <- Estado global (Zustand)</p><p>`  `types/       <- Interfaces TypeScript</p><p>`  `utils/       <- rrule helpers, date formatters, uuid</p>|
| :- |

## **10.2 Dependencias Clave**

|**Dependencia**|**Version**|**Uso**|
| :-: | :-: | :-: |
|react|18\.x|Framework UI|
|typescript|5\.x|Tipado estatico|
|vite|5\.x|Build tool + dev server|
|dexie|4\.x|Wrapper IndexedDB|
|@tanstack/react-query|5\.x|Cache y estado de datos async|
|@tanstack/react-table|8\.x|Vista de tabla con edicion inline|
|@fullcalendar/react|6\.x|Componente de calendario|
|rrule|2\.x|Parser y expander de RRULE iCal|
|zustand|4\.x|Estado global minimalista|
|vite-plugin-pwa|latest|Service Worker y manifest PWA|

|<p>**UniPlanner v2.0 — Documento cerrado y listo para desarrollo**</p><p>Brian Tomadin — Abril 2026</p>|
| :-: |

