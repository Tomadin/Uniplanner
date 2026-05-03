// ─── Enums ────────────────────────────────────────────────────────────────────

export type TaskPriority = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

// ─── Entidades de dominio (sec. 4.2) ─────────────────────────────────────────

export interface Subject {
  id: string;           // UUID generado en cliente
  name: string;
  color: string;        // Hex color p.ej. "#D98880"
  isActive: boolean;    // false = cuatrimestre anterior
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601 — Last-Write-Wins
}

export interface Task {
  id: string;
  subjectId: string | null;       // null = tarea general
  parentTaskId: string | null;    // null = tarea raíz
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;         // ISO 8601 opcional
  completedAt: string | null;     // Para limpieza a los 7 días
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Event {
  id: string;
  subjectId: string | null;           // null = evento general
  title: string;
  startTime: string;                  // ISO 8601
  endTime: string;                    // ISO 8601
  isExam: boolean;                    // badge diferenciado en calendario
  recurrenceRule: string | null;      // RRULE iCal p.ej. "FREQ=WEEKLY;BYDAY=MO,WE"
  recurrenceEndDate: string | null;   // ISO 8601 límite de recurrencia
  updatedAt: string;
}

export interface QuickNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Estructura del archivo Drive ─────────────────────────────────────────────

export interface DriveDataFile {
  version: number;
  exportedAt: string;   // ISO 8601
  subjects: Subject[];
  tasks: Task[];
  events: Event[];
  quickNotes: QuickNote[];
}

// ─── Autenticación ────────────────────────────────────────────────────────────

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
}

export interface AuthState {
  user: GoogleUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  tokenExpiry: number | null;   // timestamp epoch ms
}
