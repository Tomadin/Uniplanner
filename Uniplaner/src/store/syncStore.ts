import { create } from 'zustand';

interface SyncStore {
  isSyncing: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  pendingChanges: boolean;
  setSyncing: (isSyncing: boolean) => void;
  setSyncSuccess: () => void;
  setSyncError: (message: string) => void;
  clearSyncError: () => void;
  setDirty: (dirty: boolean) => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  syncError: null,
  pendingChanges: false,

  setSyncing:     (isSyncing) => set({ isSyncing }),
  setSyncSuccess: () => set({ isSyncing: false, lastSyncAt: new Date().toISOString(), syncError: null, pendingChanges: false }),
  setSyncError:   (syncError) => set({ isSyncing: false, syncError }),
  clearSyncError: () => set({ syncError: null }),
  setDirty:       (dirty) => set({ pendingChanges: dirty }),
}));
