import { create } from 'zustand';
import type { GoogleUser, AuthState } from '../types';

const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const USER_EMAIL_KEY = 'up-user-email';

interface AuthStore extends AuthState {
  isInitializing: boolean;
  setUser: (user: GoogleUser | null) => void;
  setAccessToken: (token: string | null, expiresInSeconds?: number) => void;
  clearAuth: () => void;
  isTokenValid: () => boolean;
  setInitializing: (v: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  tokenExpiry: null,
  isInitializing: true,

  setUser: (user) => {
    if (user) localStorage.setItem(USER_EMAIL_KEY, user.email);
    else localStorage.removeItem(USER_EMAIL_KEY);
    set({ user, isAuthenticated: !!user && !!get().accessToken });
  },

  setAccessToken: (token, expiresInSeconds = 3600) => {
    const expiry = token ? Date.now() + expiresInSeconds * 1000 : null;
    set({ accessToken: token, tokenExpiry: expiry, isAuthenticated: !!token && !!get().user });
  },

  clearAuth: () => {
    localStorage.removeItem(USER_EMAIL_KEY);
    set({ user: null, accessToken: null, isAuthenticated: false, tokenExpiry: null });
  },

  isTokenValid: () => {
    const { tokenExpiry } = get();
    if (!tokenExpiry) return false;
    return Date.now() < tokenExpiry - TOKEN_SAFETY_MARGIN_MS;
  },

  setInitializing: (v) => set({ isInitializing: v }),
}));
