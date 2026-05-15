import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db/db';
import { generateId, nowIso } from '../utils/uuid';
import type { Subject, ScheduleSlot, Event } from '../types';

const KEY = ['subjects'] as const;

const DAY_RRULE: Record<number, string> = {
  0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA',
};

function buildScheduleEvents(
  subjectId: string,
  subjectName: string,
  schedule: ScheduleSlot[],
  courseEndDate: string | null,
  now = new Date(),
): Omit<Event, 'id' | 'updatedAt'>[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return schedule.map(slot => {
    // Primer ocurrencia del día de semana a partir de hoy (inclusive si hoy es ese día)
    const diff = (slot.dayOfWeek - today.getDay() + 7) % 7;
    const firstDay = new Date(today);
    firstDay.setDate(firstDay.getDate() + diff);

    const [sh, sm] = slot.startTime.split(':').map(Number);
    const [eh, em] = slot.endTime.split(':').map(Number);
    const start = new Date(firstDay); start.setHours(sh, sm, 0, 0);
    const end   = new Date(firstDay); end.setHours(eh, em, 0, 0);

    return {
      title: subjectName,
      subjectId,
      startTime: start.toISOString(),
      endTime:   end.toISOString(),
      isExam: false,
      recurrenceRule: `FREQ=WEEKLY;BYDAY=${DAY_RRULE[slot.dayOfWeek]}`,
      recurrenceEndDate: courseEndDate,
    };
  });
}

export function useSubjects() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => db.subjects.toArray().then(arr => arr.sort((a, b) => a.name.localeCompare(b.name))),
  });
}

export function useAddSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<Subject, 'id' | 'createdAt' | 'updatedAt'>) => {
      const id = generateId();
      const now = nowIso();
      await db.transaction('rw', db.subjects, db.events, async () => {
        await db.subjects.add({ ...input, id, createdAt: now, updatedAt: now });
        const slots = input.schedule ?? [];
        if (slots.length > 0) {
          const evts = buildScheduleEvents(id, input.name, slots, input.courseEndDate ?? null);
          await db.events.bulkAdd(evts.map(e => ({ ...e, id: generateId(), updatedAt: now })));
        }
      });
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => console.error('[UP] useAddSubject:', err),
  });
}

export function useUpdateSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, regenerateEvents }: {
      id: string;
      changes: Partial<Subject>;
      regenerateEvents?: boolean;
    }) => {
      const now = nowIso();
      await db.transaction('rw', db.subjects, db.events, async () => {
        await db.subjects.update(id, { ...changes, updatedAt: now });
        if (regenerateEvents) {
          const toDelete = await db.events
            .where('subjectId').equals(id)
            .filter(e => !!e.recurrenceRule && !e.isExam)
            .primaryKeys();
          if (toDelete.length) await db.events.bulkDelete(toDelete as string[]);
          const slots = changes.schedule ?? [];
          if (slots.length > 0) {
            const subj = await db.subjects.get(id);
            const evts = buildScheduleEvents(
              id,
              subj?.name ?? changes.name ?? '',
              slots,
              changes.courseEndDate ?? null,
            );
            await db.events.bulkAdd(evts.map(e => ({ ...e, id: generateId(), updatedAt: now })));
          }
        }
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => console.error('[UP] useUpdateSubject:', err),
  });
}

export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await db.transaction('rw', db.subjects, db.events, async () => {
        await db.events.where('subjectId').equals(id).delete();
        await db.subjects.delete(id);
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => console.error('[UP] useDeleteSubject:', err),
  });
}
