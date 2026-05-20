import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubjects, useAddSubject, useDeleteSubject, useUpdateSubject } from './useSubjects';
import { db } from '../db/db';
import type { Subject, ScheduleSlot } from '../types/index';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function baseSubjectInput(): Omit<Subject, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: 'Matemáticas', color: '#D98880', isActive: true,
    schedule: [], courseEndDate: null,
  };
}

const MON_SLOT: ScheduleSlot = { dayOfWeek: 1, startTime: '08:00', endTime: '10:00' };
const WED_SLOT: ScheduleSlot = { dayOfWeek: 3, startTime: '14:00', endTime: '16:00' };

describe('useAddSubject', () => {
  it('crea una materia con id, color e isActive correctos', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => { result.current.mutate(baseSubjectInput()); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const subjects = await db.subjects.toArray();
    expect(subjects).toHaveLength(1);
    expect(subjects[0].id).toBeTruthy();
    expect(subjects[0].color).toBe('#D98880');
    expect(subjects[0].isActive).toBe(true);
  });

  it('con schedule genera eventos recurrentes WEEKLY', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => {
      result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT, WED_SLOT] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const events = await db.events.toArray();
    expect(events).toHaveLength(2);
  });

  it('los eventos generados tienen el subjectId correcto y FREQ=WEEKLY', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => {
      result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const subjects = await db.subjects.toArray();
    const events = await db.events.toArray();
    expect(events[0].subjectId).toBe(subjects[0].id);
    expect(events[0].recurrenceRule).toContain('FREQ=WEEKLY');
  });

  it('los eventos de clase tienen isExam=false', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => {
      result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const events = await db.events.toArray();
    expect(events.every(e => e.isExam === false)).toBe(true);
  });

  it('con schedule=undefined usa [] por defecto (rama ?? [])', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddSubject(), { wrapper });
    // No se pasa schedule → input.schedule es undefined → cubre la rama ?? []
    await act(async () => {
      result.current.mutate({
        name: 'Sin horario', color: '#000', isActive: true, courseEndDate: null,
      });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(await db.events.count()).toBe(0);
    expect(await db.subjects.count()).toBe(1);
  });

  it('sin schedule no genera eventos', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => { result.current.mutate(baseSubjectInput()); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const events = await db.events.toArray();
    expect(events).toHaveLength(0);
  });
});

describe('useDeleteSubject', () => {
  it('elimina la materia y todos sus eventos de horario', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => {
      addHook.result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT, WED_SLOT] });
    });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const subjectId = (await db.subjects.toArray())[0].id;
    expect(await db.events.count()).toBe(2);

    const deleteHook = renderHook(() => useDeleteSubject(), { wrapper });
    await act(async () => { deleteHook.result.current.mutate(subjectId); });
    await waitFor(() => expect(deleteHook.result.current.isSuccess).toBe(true));

    expect(await db.subjects.count()).toBe(0);
    expect(await db.events.count()).toBe(0);
  });
});

describe('useUpdateSubject', () => {
  it('con regenerateEvents=true elimina eventos viejos y crea nuevos', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => {
      addHook.result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT] });
    });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const subjectId = (await db.subjects.toArray())[0].id;
    const oldEvents = await db.events.toArray();
    expect(oldEvents).toHaveLength(1);
    const oldEventId = oldEvents[0].id;

    const updateHook = renderHook(() => useUpdateSubject(), { wrapper });
    await act(async () => {
      updateHook.result.current.mutate({
        id: subjectId,
        changes: { schedule: [MON_SLOT, WED_SLOT] },
        regenerateEvents: true,
      });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));

    const newEvents = await db.events.toArray();
    expect(newEvents).toHaveLength(2);
    expect(newEvents.find(e => e.id === oldEventId)).toBeUndefined();
  });
});

describe('useUpdateSubject — ramas adicionales', () => {
  it('con changes sin schedule usa [] por defecto (rama ?? [] en updateSubject)', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddSubject(), { wrapper });
    await act(async () => {
      addHook.result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT] });
    });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const subjectId = (await db.subjects.toArray())[0].id;

    const updateHook = renderHook(() => useUpdateSubject(), { wrapper });
    await act(async () => {
      // changes sin schedule → changes.schedule=undefined → slots=[] vía ?? []
      updateHook.result.current.mutate({
        id: subjectId,
        changes: { name: 'Nuevo nombre' },
        regenerateEvents: true,
      });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));
    // slots=[] → no se crean nuevos eventos; se borraron los anteriores
    expect(await db.events.count()).toBe(0);
    const subj = (await db.subjects.toArray())[0];
    expect(subj.name).toBe('Nuevo nombre');
  });

  it('usa changes.name como fallback cuando el subject no existe en DB (rama ?? changes.name)', async () => {
    const wrapper = createWrapper();
    const updateHook = renderHook(() => useUpdateSubject(), { wrapper });
    // ID inexistente → db.subjects.get() devuelve undefined → subj?.name=undefined → usa changes.name
    await act(async () => {
      updateHook.result.current.mutate({
        id: 'id-inexistente',
        changes: { name: 'Nombre de fallback', schedule: [MON_SLOT] },
        regenerateEvents: true,
      });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));
    // Se creó un evento con el nombre de fallback
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Nombre de fallback');
  });

  it('usa "" como último fallback cuando subject no existe y changes.name es undefined (rama ?? "")', async () => {
    const wrapper = createWrapper();
    const updateHook = renderHook(() => useUpdateSubject(), { wrapper });
    // ID inexistente + sin name en changes → subj?.name=undefined, changes.name=undefined → ''
    await act(async () => {
      updateHook.result.current.mutate({
        id: 'id-inexistente',
        changes: { schedule: [MON_SLOT] },  // sin name
        regenerateEvents: true,
      });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));
    const events = await db.events.toArray();
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('');
  });

  it('con regenerateEvents=false NO toca los eventos existentes', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => {
      addHook.result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT] });
    });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const subjectId = (await db.subjects.toArray())[0].id;
    expect(await db.events.count()).toBe(1);

    const updateHook = renderHook(() => useUpdateSubject(), { wrapper });
    await act(async () => {
      updateHook.result.current.mutate({
        id: subjectId,
        changes: { name: 'Mate Actualizado' },
        // regenerateEvents no especificado → undefined → false
      });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));

    expect(await db.events.count()).toBe(1);  // eventos intactos
    const subj = (await db.subjects.toArray())[0];
    expect(subj.name).toBe('Mate Actualizado');
  });

  it('con regenerateEvents=true y schedule vacío elimina eventos sin crear nuevos', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddSubject(), { wrapper });

    await act(async () => {
      addHook.result.current.mutate({ ...baseSubjectInput(), schedule: [MON_SLOT] });
    });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const subjectId = (await db.subjects.toArray())[0].id;
    expect(await db.events.count()).toBe(1);

    const updateHook = renderHook(() => useUpdateSubject(), { wrapper });
    await act(async () => {
      updateHook.result.current.mutate({
        id: subjectId,
        changes: { schedule: [] },
        regenerateEvents: true,
      });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));

    expect(await db.events.count()).toBe(0);
  });

  it('con regenerateEvents=true y sin eventos previos no llama a bulkDelete', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddSubject(), { wrapper });

    // Crear materia SIN schedule → no hay eventos
    await act(async () => { addHook.result.current.mutate(baseSubjectInput()); });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const subjectId = (await db.subjects.toArray())[0].id;
    expect(await db.events.count()).toBe(0);

    const updateHook = renderHook(() => useUpdateSubject(), { wrapper });
    await act(async () => {
      updateHook.result.current.mutate({
        id: subjectId,
        changes: { schedule: [WED_SLOT] },
        regenerateEvents: true,
      });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));

    // Se creó el nuevo evento a pesar de no haber tenido ninguno antes
    expect(await db.events.count()).toBe(1);
  });
});

describe('onError handlers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('useAddSubject — onError llama a console.error cuando Dexie falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.subjects, 'add').mockRejectedValueOnce(new Error('DB fail'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddSubject(), { wrapper });
    await act(async () => { result.current.mutate(baseSubjectInput()); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(consoleSpy).toHaveBeenCalledWith('[UP] useAddSubject:', expect.any(Error));
  });

  it('useUpdateSubject — onError llama a console.error cuando Dexie falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.subjects, 'update').mockRejectedValueOnce(new Error('DB fail'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateSubject(), { wrapper });
    await act(async () => {
      result.current.mutate({ id: 'x', changes: { name: 'Y' } });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(consoleSpy).toHaveBeenCalledWith('[UP] useUpdateSubject:', expect.any(Error));
  });

  it('useDeleteSubject — onError llama a console.error cuando Dexie falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.subjects, 'delete').mockRejectedValueOnce(new Error('DB fail'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteSubject(), { wrapper });
    await act(async () => { result.current.mutate('subject-id'); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(consoleSpy).toHaveBeenCalledWith('[UP] useDeleteSubject:', expect.any(Error));
  });
});

describe('useSubjects', () => {
  it('devuelve las materias y se actualiza tras crear una nueva', async () => {
    const wrapper = createWrapper();
    const { result: listResult } = renderHook(() => useSubjects(), { wrapper });
    const addHook = renderHook(() => useAddSubject(), { wrapper });

    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toHaveLength(0);

    await act(async () => { addHook.result.current.mutate(baseSubjectInput()); });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));

    await waitFor(() => expect(listResult.current.data).toHaveLength(1));
    expect(listResult.current.data?.[0].name).toBe('Matemáticas');
  });
});
