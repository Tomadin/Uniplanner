import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SyncService } from '../sync/SyncService';
import { useAuthStore } from '../auth/authStore';
import { useAuth } from '../auth/GoogleAuthProvider';
import { useSyncStore } from '../store/syncStore';

export function useSync() {
  const { isAuthenticated } = useAuthStore();
  const { refreshTokenSilently } = useAuth();
  const { setSyncing, setSyncSuccess, setSyncError } = useSyncStore();
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

    setSyncing(true);
    svc.initialize()
      .then(() => { setSyncSuccess(); invalidateAll(); })
      .catch(() => setSyncError('Error al sincronizar al iniciar.'));

    const cleanup = svc.schedulePeriodicSync();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const syncNow = () => serviceRef.current?.save();

  return { syncNow };
}
