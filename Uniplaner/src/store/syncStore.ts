import { create } from 'zustand';

interface SyncStore {
  isSyncing: boolean;
  lastSyncAt: string | null;
  syncError: string | null;
  setSyncing: (isSyncing: boolean) => void;
  setSyncSuccess: () => void;
  setSyncError: (message: string) => void;
  clearSyncError: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  isSyncing: false,
  lastSyncAt: null,
  syncError: null,

  setSyncing:     (isSyncing) => set({ isSyncing }),
  setSyncSuccess: () => set({ isSyncing: false, lastSyncAt: new Date().toISOString(), syncError: null }),
  setSyncError:   (syncError) => set({ isSyncing: false, syncError }),
  clearSyncError: () => set({ syncError: null }),
}));
