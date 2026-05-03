import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/db';
import { generateId, nowIso } from '../utils/uuid';
import type { Event } from '../types';

const KEY = ['events'] as const;

export function useEvents() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => db.events.orderBy('startTime').toArray(),
  });
}

export function useAddEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Event, 'id' | 'updatedAt'>) =>
      db.events.add({ ...input, id: generateId(), updatedAt: nowIso() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useAddEvent:', err),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: Partial<Event> }) =>
      db.events.update(id, { ...changes, updatedAt: nowIso() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useUpdateEvent:', err),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.events.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    onError: (err) => console.error('[UP] useDeleteEvent:', err),
  });
}
