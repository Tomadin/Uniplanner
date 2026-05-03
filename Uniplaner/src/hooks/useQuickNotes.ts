import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/db';
import { generateId, nowIso } from '../utils/uuid';

const KEY = ['quickNotes'] as const;

export function useQuickNotes() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => db.quickNotes.orderBy('updatedAt').reverse().toArray(),
  });
}

export function useAddQuickNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => {
      const now = nowIso();
      return db.quickNotes.add({ id: generateId(), content, createdAt: now, updatedAt: now });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteQuickNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.quickNotes.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
