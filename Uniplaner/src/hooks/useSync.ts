import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SyncService } from '../sync/SyncService';
import { useAuthStore } from '../auth/authStore';
import { useAuth } from '../auth/GoogleAuthProvider';
import { useSyncStore } from '../store/syncStore';

export function useSync() {
  const { isAuthenticated } = useAuthStore();
  const { refreshTokenSilently } = useAuth();
  const { setSyncing, setSyncSuccess, setSyncError, setDirty } = useSyncStore();
  const qc = useQueryClient();
  const serviceRef = useRef<SyncService | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const invalidateAll = () => qc.invalidateQueries();

    const svc = new SyncService({
      getAccessToken: () => useAuthStore.getState().accessToken,
      refreshToken: refreshTokenSilently,
      onSyncStart: () => setSyncing(true),
      onSyncSuccess: () => { setSyncSuccess(); invalidateAll(); },
      onSyncError: setSyncError,
    });
    serviceRef.current = svc;

    let cleanupPeriodic: (() => void) | null = null;
    let visibilityTimer: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (visibilityTimer) clearTimeout(visibilityTimer);
        visibilityTimer = setTimeout(() => { svc.save().catch(console.error); }, 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const unsubMutations = qc.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.mutation?.state.status === 'success') {
        setDirty(true);
      }
    });

    setSyncing(true);
    svc.initialize()
      .then(() => {
        setSyncSuccess();
        invalidateAll();
        cleanupPeriodic = svc.schedulePeriodicSync();
      })
      .catch(() => setSyncError('Error al sincronizar al iniciar.'));

    return () => {
      cleanupPeriodic?.();
      if (visibilityTimer) clearTimeout(visibilityTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubMutations();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const syncNow = () => serviceRef.current?.save();

  return { syncNow };
}
