import { create } from 'zustand';
import type { GoogleUser, AuthState } from '../types';

// Margen de seguridad: renovar token 5 minutos antes de que expire
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;

interface AuthStore extends AuthState {
  setUser: (user: GoogleUser | null) => void;
  setAccessToken: (token: string | null, expiresInSeconds?: number) => void;
  clearAuth: () => void;
  isTokenValid: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  tokenExpiry: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setAccessToken: (token, expiresInSeconds = 3600) => {
    const expiry = token ? Date.now() + expiresInSeconds * 1000 : null;
    set({ accessToken: token, tokenExpiry: expiry });
  },

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      tokenExpiry: null,
    }),

  isTokenValid: () => {
    const { tokenExpiry } = get();
    if (!tokenExpiry) return false;
    return Date.now() < tokenExpiry - TOKEN_SAFETY_MARGIN_MS;
  },
}));
