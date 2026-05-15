import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/db';
import type { PersonalItem } from '../types';
import { generateId } from '../utils/uuid';

const QK = ['personalLists'] as const;

export function usePersonalLists() {
  return useQuery({
    queryKey: QK,
    queryFn: () =>
      db.personalLists
        .toArray()
        .then(arr => arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
  });
}

export function useAddPersonalList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => {
      const now = new Date().toISOString();
      return db.personalLists.add({ id: generateId(), name, items: [], createdAt: now, updatedAt: now });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err) => console.error('addPersonalList', err),
  });
}

export function useRenamePersonalList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      db.personalLists.update(id, { name, updatedAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err) => console.error('renamePersonalList', err),
  });
}

export function useDeletePersonalList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.personalLists.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err) => console.error('deletePersonalList', err),
  });
}

export function useAddPersonalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, text }: { listId: string; text: string }) => {
      const list = await db.personalLists.get(listId);
      if (!list) return;
      const item: PersonalItem = { id: generateId(), text, done: false };
      return db.personalLists.update(listId, {
        items: [...list.items, item],
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err) => console.error('addPersonalItem', err),
  });
}

export function useTogglePersonalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, itemId }: { listId: string; itemId: string }) => {
      const list = await db.personalLists.get(listId);
      if (!list) return;
      return db.personalLists.update(listId, {
        items: list.items.map((it) => it.id === itemId ? { ...it, done: !it.done } : it),
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err) => console.error('togglePersonalItem', err),
  });
}

export function useDeletePersonalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, itemId }: { listId: string; itemId: string }) => {
      const list = await db.personalLists.get(listId);
      if (!list) return;
      return db.personalLists.update(listId, {
        items: list.items.filter((it) => it.id !== itemId),
        updatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err) => console.error('deletePersonalItem', err),
  });
}

export function useUpdatePersonalListItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, items }: { listId: string; items: PersonalItem[] }) =>
      db.personalLists.update(listId, { items, updatedAt: new Date().toISOString() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
    onError: (err) => console.error('updatePersonalListItems', err),
  });
}
