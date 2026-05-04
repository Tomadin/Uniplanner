import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/db';
import { generateId, nowIso } from '../utils/uuid';
import type { Subject } from '../types';

const KEY = ['subjects'] as const;

export function useSubjects() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => db.subjects.toArray().then(arr => arr.sort((a, b) => a.name.localeCompare(b.name))),
  });
}

export function useAddSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = nowIso();
      return db.subjects.add({ ...input, id: generateId(), createdAt: now, updatedAt: now });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useAddSubject:', err),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<Subject> }) =>
      db.subjects.update(id, { ...changes, updatedAt: nowIso() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useUpdateSubject:', err),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.subjects.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useDeleteSubject:', err),
  });
}
