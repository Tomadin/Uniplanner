import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/db';
import { generateId, nowIso } from '../utils/uuid';
import type { Task, TaskPriority, TaskStatus } from '../types';

const KEY = ['tasks'] as const;

export function useTasks() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => db.tasks.orderBy('updatedAt').reverse().toArray(),
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = nowIso();
      return db.tasks.add({ ...input, id: generateId(), createdAt: now, updatedAt: now });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useAddTask:', err),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<Task> }) =>
      db.tasks.update(id, { ...changes, updatedAt: nowIso() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useUpdateTask:', err),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Task) => {
      const now = nowIso();
      const isCompleted = task.status !== 'COMPLETED';
      return db.tasks.update(task.id, {
        status: isCompleted ? 'COMPLETED' : ('NOT_STARTED' as TaskStatus),
        completedAt: isCompleted ? now : null,
        updatedAt: now,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useToggleTask:', err),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const children = await db.tasks.where('parentTaskId').equals(id).toArray();
      await db.tasks.bulkDelete([id, ...children.map(c => c.id)]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useDeleteTask:', err),
  });
}

// Helpers de tipado para ciclar prioridad/estado
export const PRIORITY_CYCLE: TaskPriority[] = ['NONE','LOW','MEDIUM','HIGH','URGENT'];
export const STATUS_CYCLE: TaskStatus[] = ['NOT_STARTED','IN_PROGRESS','COMPLETED','CANCELLED'];
