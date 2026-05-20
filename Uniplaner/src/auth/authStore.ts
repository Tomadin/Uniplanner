import { create } from 'zustand';
import type { GoogleUser, AuthState } from '../types';

const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;
const USER_EMAIL_KEY = 'up-user-email';
const TOKEN_KEY = 'up-access-token';
const TOKEN_EXPIRY_KEY = 'up-token-expiry';
const USER_KEY = 'up-user';

interface AuthStore extends AuthState {
  isInitializing: boolean;
  setUser: (user: GoogleUser | null) => void;
  setAccessToken: (token: string | null, expiresInSeconds?: number) => void;
  clearAuth: () => void;
  isTokenValid: () => boolean;
  setInitializing: (v: boolean) => void;
  restoreFromStorage: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  tokenExpiry: null,
  isInitializing: true,

  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_EMAIL_KEY, user.email);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_EMAIL_KEY);
      localStorage.removeItem(USER_KEY);
    }
    set({ user, isAuthenticated: !!user && !!get().accessToken });
  },

  setAccessToken: (token, expiresInSeconds = 3600) => {
    const expiry = token ? Date.now() + expiresInSeconds * 1000 : null;
    if (token && expiry) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
    }
    set({ accessToken: token, tokenExpiry: expiry, isAuthenticated: !!token && !!get().user });
  },

  clearAuth: () => {
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem('uniplanner-sync-snapshot');
    set({ user: null, accessToken: null, isAuthenticated: false, tokenExpiry: null });
  },

  isTokenValid: () => {
    const { tokenExpiry } = get();
    if (!tokenExpiry) return false;
    return Date.now() < tokenExpiry - TOKEN_SAFETY_MARGIN_MS;
  },

  setInitializing: (v) => set({ isInitializing: v }),

  restoreFromStorage: () => {
    const token = localStorage.getItem(TOKEN_KEY);
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !expiryStr || !userStr) return false;

    const expiry = Number(expiryStr);
    if (Date.now() >= expiry - TOKEN_SAFETY_MARGIN_MS) return false;

    try {
      const user: GoogleUser = JSON.parse(userStr);
      set({ user, accessToken: token, tokenExpiry: expiry, isAuthenticated: true });
      return true;
    } catch {
      return false;
    }
  },
}));
