import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';

const KEYS = [
  'up-user-email',
  'up-user',
  'up-access-token',
  'up-token-expiry',
  'uniplanner-sync-snapshot',
];

function resetStore() {
  useAuthStore.getState().clearAuth();
  localStorage.clear();
}

describe('authStore', () => {
  beforeEach(resetStore);

  it('setUser guarda el usuario en el store y en localStorage', () => {
    const user = { id: 'u1', name: 'Ana', email: 'ana@test.com', picture: '' };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
    expect(localStorage.getItem('up-user')).toBe(JSON.stringify(user));
    expect(localStorage.getItem('up-user-email')).toBe('ana@test.com');
  });

  it('setUser(null) elimina el usuario del store y de localStorage', () => {
    const user = { id: 'u1', name: 'Ana', email: 'ana@test.com', picture: '' };
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('up-user')).toBeNull();
  });

  it('setAccessToken guarda el token y calcula la expiración', () => {
    const before = Date.now();
    useAuthStore.getState().setAccessToken('tok123', 3600);
    const { accessToken, tokenExpiry } = useAuthStore.getState();
    expect(accessToken).toBe('tok123');
    expect(tokenExpiry).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(localStorage.getItem('up-access-token')).toBe('tok123');
  });

  it('isTokenValid retorna true cuando el token no venció', () => {
    useAuthStore.getState().setAccessToken('tok', 3600);
    expect(useAuthStore.getState().isTokenValid()).toBe(true);
  });

  it('isTokenValid retorna false cuando el token venció', () => {
    useAuthStore.getState().setAccessToken('tok', -1);   // expira en el pasado
    expect(useAuthStore.getState().isTokenValid()).toBe(false);
  });

  it('isTokenValid retorna false sin token', () => {
    expect(useAuthStore.getState().isTokenValid()).toBe(false);
  });

  it('clearAuth resetea el estado del store', () => {
    const user = { id: 'u1', name: 'Ana', email: 'ana@test.com', picture: '' };
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setAccessToken('tok', 3600);
    useAuthStore.getState().clearAuth();
    const { user: u, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(u).toBeNull();
    expect(accessToken).toBeNull();
    expect(isAuthenticated).toBe(false);
  });

  it('clearAuth elimina todas las claves de localStorage', () => {
    KEYS.forEach(k => localStorage.setItem(k, 'valor'));
    useAuthStore.getState().clearAuth();
    KEYS.forEach(k => expect(localStorage.getItem(k)).toBeNull());
  });

  it('restoreFromStorage recupera una sesión guardada', () => {
    const user = { id: 'u1', name: 'Ana', email: 'ana@test.com', picture: '' };
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setAccessToken('tok', 3600);
    // Simular nuevo inicio: resetear estado sin borrar localStorage
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, tokenExpiry: null });

    const restored = useAuthStore.getState().restoreFromStorage();
    expect(restored).toBe(true);
    expect(useAuthStore.getState().user?.id).toBe('u1');
    expect(useAuthStore.getState().accessToken).toBe('tok');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('restoreFromStorage retorna false si el token está vencido', () => {
    const user = { id: 'u1', name: 'Ana', email: 'ana@test.com', picture: '' };
    useAuthStore.getState().setUser(user);
    // Guardar un token con expiración en el pasado directamente en localStorage
    localStorage.setItem('up-access-token', 'tok');
    localStorage.setItem('up-token-expiry', String(Date.now() - 1000));
    useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, tokenExpiry: null });

    const restored = useAuthStore.getState().restoreFromStorage();
    expect(restored).toBe(false);
  });
});
