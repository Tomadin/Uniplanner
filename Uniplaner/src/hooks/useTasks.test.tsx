import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasks, useAddTask, useToggleTask, useDeleteTask, useUpdateTask } from './useTasks';
import { db } from '../db/db';
import type { Task } from '../types/index';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function baseInput(): Omit<Task, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    subjectId: null, parentTaskId: null, title: 'Test task',
    description: null, priority: 'MEDIUM', status: 'NOT_STARTED',
    dueDate: null, completedAt: null, observations: null,
  };
}

describe('useAddTask', () => {
  it('crea una tarea con id, createdAt y updatedAt generados', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddTask(), { wrapper });

    await act(async () => { result.current.mutate(baseInput()); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const tasks = await db.tasks.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBeTruthy();
    expect(tasks[0].createdAt).toBeTruthy();
    expect(tasks[0].updatedAt).toBeTruthy();
  });

  it('guarda la dueDate como cadena YYYY-MM-DD sin conversión', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddTask(), { wrapper });

    await act(async () => { result.current.mutate({ ...baseInput(), dueDate: '2026-06-01' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const tasks = await db.tasks.toArray();
    expect(tasks[0].dueDate).toBe('2026-06-01');
  });

  it('vincula la tarea a una materia via subjectId', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddTask(), { wrapper });

    await act(async () => { result.current.mutate({ ...baseInput(), subjectId: 'subj-1' }); });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const tasks = await db.tasks.toArray();
    expect(tasks[0].subjectId).toBe('subj-1');
  });
});

describe('useToggleTask', () => {
  it('cambia el estado a COMPLETED y asigna completedAt', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddTask(), { wrapper });
    await act(async () => { addHook.result.current.mutate(baseInput()); });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const task = (await db.tasks.toArray())[0];

    const toggleHook = renderHook(() => useToggleTask(), { wrapper });
    await act(async () => { toggleHook.result.current.mutate(task); });
    await waitFor(() => expect(toggleHook.result.current.isSuccess).toBe(true));

    const updated = await db.tasks.get(task.id);
    expect(updated?.status).toBe('COMPLETED');
    expect(updated?.completedAt).toBeTruthy();
  });

  it('vuelve a NOT_STARTED y limpia completedAt si ya estaba COMPLETED', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddTask(), { wrapper });
    await act(async () => { addHook.result.current.mutate(baseInput()); });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const task = (await db.tasks.toArray())[0];

    // Primera pasada: marcar como completada
    const toggle1 = renderHook(() => useToggleTask(), { wrapper });
    await act(async () => { toggle1.result.current.mutate(task); });
    await waitFor(() => expect(toggle1.result.current.isSuccess).toBe(true));
    const completed = (await db.tasks.get(task.id))!;

    // Segunda pasada: desmarcar
    const toggle2 = renderHook(() => useToggleTask(), { wrapper });
    await act(async () => { toggle2.result.current.mutate(completed); });
    await waitFor(() => expect(toggle2.result.current.isSuccess).toBe(true));

    const reverted = await db.tasks.get(task.id);
    expect(reverted?.status).toBe('NOT_STARTED');
    expect(reverted?.completedAt).toBeNull();
  });
});

describe('useDeleteTask', () => {
  it('elimina la tarea y todas sus subtareas', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddTask(), { wrapper });

    // Crear tarea padre
    await act(async () => { addHook.result.current.mutate(baseInput()); });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const parent = (await db.tasks.toArray())[0];

    // Crear subtarea
    await act(async () => {
      addHook.result.current.mutate({ ...baseInput(), parentTaskId: parent.id });
    });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));

    expect(await db.tasks.count()).toBe(2);

    // Eliminar padre (debe arrastrar la subtarea)
    const deleteHook = renderHook(() => useDeleteTask(), { wrapper });
    await act(async () => { deleteHook.result.current.mutate(parent.id); });
    await waitFor(() => expect(deleteHook.result.current.isSuccess).toBe(true));

    expect(await db.tasks.count()).toBe(0);
  });
});

describe('useUpdateTask', () => {
  it('actualiza los campos y actualiza updatedAt', async () => {
    const wrapper = createWrapper();
    const addHook = renderHook(() => useAddTask(), { wrapper });
    await act(async () => { addHook.result.current.mutate(baseInput()); });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));
    const task = (await db.tasks.toArray())[0];
    const originalUpdatedAt = task.updatedAt;

    // Esperar 1ms para que updatedAt sea diferente
    await new Promise(r => setTimeout(r, 5));

    const updateHook = renderHook(() => useUpdateTask(), { wrapper });
    await act(async () => {
      updateHook.result.current.mutate({ id: task.id, changes: { title: 'Actualizado' } });
    });
    await waitFor(() => expect(updateHook.result.current.isSuccess).toBe(true));

    const updated = await db.tasks.get(task.id);
    expect(updated?.title).toBe('Actualizado');
    expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
  });
});

describe('onError handlers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('useAddTask — onError llama a console.error cuando Dexie falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.tasks, 'add').mockRejectedValueOnce(new Error('DB fail'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useAddTask(), { wrapper });
    await act(async () => { result.current.mutate(baseInput()); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(consoleSpy).toHaveBeenCalledWith('[UP] useAddTask:', expect.any(Error));
  });

  it('useUpdateTask — onError llama a console.error cuando Dexie falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.tasks, 'update').mockRejectedValueOnce(new Error('DB fail'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useUpdateTask(), { wrapper });
    await act(async () => {
      result.current.mutate({ id: 'x', changes: { title: 'Y' } });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(consoleSpy).toHaveBeenCalledWith('[UP] useUpdateTask:', expect.any(Error));
  });

  it('useToggleTask — onError llama a console.error cuando Dexie falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.tasks, 'update').mockRejectedValueOnce(new Error('DB fail'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useToggleTask(), { wrapper });
    const fakeTask: Task = {
      id: 'x', subjectId: null, parentTaskId: null, title: 'T',
      description: null, priority: 'MEDIUM', status: 'NOT_STARTED',
      dueDate: null, completedAt: null, observations: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    };
    await act(async () => { result.current.mutate(fakeTask); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(consoleSpy).toHaveBeenCalledWith('[UP] useToggleTask:', expect.any(Error));
  });

  it('useDeleteTask — onError llama a console.error cuando Dexie falla', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(db.tasks, 'bulkDelete').mockRejectedValueOnce(new Error('DB fail'));

    const wrapper = createWrapper();
    const { result } = renderHook(() => useDeleteTask(), { wrapper });
    await act(async () => { result.current.mutate('task-id'); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(consoleSpy).toHaveBeenCalledWith('[UP] useDeleteTask:', expect.any(Error));
  });
});

describe('useTasks', () => {
  it('devuelve las tareas y se actualiza tras una mutación', async () => {
    const wrapper = createWrapper();
    const { result: listResult } = renderHook(() => useTasks(), { wrapper });
    const addHook = renderHook(() => useAddTask(), { wrapper });

    await waitFor(() => expect(listResult.current.isSuccess).toBe(true));
    expect(listResult.current.data).toHaveLength(0);

    await act(async () => { addHook.result.current.mutate(baseInput()); });
    await waitFor(() => expect(addHook.result.current.isSuccess).toBe(true));

    await waitFor(() => expect(listResult.current.data).toHaveLength(1));
  });
});
