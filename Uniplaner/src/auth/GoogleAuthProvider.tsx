import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuthStore } from './authStore';

// ─── Configuración OAuth ───────────────────────────────────────────────────────

const SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
].join(' ');

const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

// ─── Declaraciones de tipos GIS (no hay @types oficial) ───────────────────────

interface OneTapNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GisTokenClientConfig) => GisTokenClient;
        };
        id: {
          initialize: (config: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            auto_select?: boolean;
            use_fedcm_for_prompt?: boolean;
          }) => void;
          prompt: (callback?: (n: OneTapNotification) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

interface GisTokenClient {
  requestAccessToken: (overrides?: { prompt?: string; hint?: string }) => void;
}

interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  error?: string;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

interface AuthContextValue {
  login: () => void;
  logout: () => void;
  /** Devuelve un access token válido. Si venció, renueva silenciosamente. */
  refreshTokenSilently: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAccessToken, clearAuth, isTokenValid, setInitializing } = useAuthStore();

  const tokenClientRef = useRef<GisTokenClient | null>(null);
  const pendingRefreshRef = useRef<Array<{
    resolve: (token: string) => void;
    reject: (err: Error) => void;
  }>>([]);
  const autoLoginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUserInfo = useCallback(
    async (accessToken: string) => {
      const res = await fetch(USERINFO_ENDPOINT, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('userinfo fetch failed');
      const data = await res.json();
      setUser({ id: data.sub, name: data.name, email: data.email, picture: data.picture });
    },
    [setUser],
  );

  const handleTokenResponse = useCallback(
    async (response: GisTokenResponse) => {
      if (response.error) {
        const err = new Error(response.error);
        pendingRefreshRef.current.forEach(({ reject }) => reject(err));
        pendingRefreshRef.current = [];
        return;
      }

      setAccessToken(response.access_token, response.expires_in);
      fetchUserInfo(response.access_token).catch(console.warn);
      pendingRefreshRef.current.forEach(({ resolve }) => resolve(response.access_token));
      pendingRefreshRef.current = [];

      setInitializing(false);
      if (autoLoginTimeoutRef.current) {
        clearTimeout(autoLoginTimeoutRef.current);
        autoLoginTimeoutRef.current = null;
      }
    },
    [setAccessToken, fetchUserInfo],
  );

  // Carga el script de GIS e inicializa el cliente de tokens
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[Auth] VITE_GOOGLE_CLIENT_ID no está configurado en .env');
      setInitializing(false);
      return;
    }

    const init = () => {
      tokenClientRef.current = window.google!.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: handleTokenResponse,
        error_callback: (err) => {
          console.error('[Auth] GIS error:', err);
          const error = new Error(err.type);
          pendingRefreshRef.current.forEach(({ reject }) => reject(error));
          pendingRefreshRef.current = [];
          setInitializing(false);
          if (autoLoginTimeoutRef.current) {
            clearTimeout(autoLoginTimeoutRef.current);
            autoLoginTimeoutRef.current = null;
          }
        },
      });

      // One Tap: auto-login silencioso via FedCM (sin depender de cookies de sesión)
      const parseJwt = (jwt: string) => {
        const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64.padEnd(b64.length + (4 - b64.length % 4) % 4, '=');
        return JSON.parse(atob(padded));
      };

      window.google!.accounts.id.initialize({
        client_id: clientId,
        auto_select: true,
        use_fedcm_for_prompt: true,
        callback: (response: { credential: string }) => {
          const p = parseJwt(response.credential);
          setUser({ id: p.sub, name: p.name, email: p.email, picture: p.picture });
          // Con FedCM activo, el token client puede renovar silenciosamente
          tokenClientRef.current?.requestAccessToken({ prompt: '', hint: p.email });
        },
      });

      const savedEmail = localStorage.getItem('up-user-email');
      if (savedEmail) {
        autoLoginTimeoutRef.current = setTimeout(() => setInitializing(false), 6000);
        window.google!.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setInitializing(false);
            if (autoLoginTimeoutRef.current) {
              clearTimeout(autoLoginTimeoutRef.current);
              autoLoginTimeoutRef.current = null;
            }
          }
        });
      } else {
        setInitializing(false);
      }
    };

    if (window.google?.accounts?.oauth2) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = init;
    script.onerror = () => {
      console.error('[Auth] No se pudo cargar el script de Google Identity Services');
      setInitializing(false);
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) document.body.removeChild(script);
    };
  }, [handleTokenResponse]);

  const login = useCallback(() => {
    tokenClientRef.current?.requestAccessToken({ prompt: 'consent' });
  }, []);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  const refreshTokenSilently = useCallback((): Promise<string> => {
    // Si el token aún es válido, devolverlo directamente
    if (isTokenValid()) {
      return Promise.resolve(useAuthStore.getState().accessToken!);
    }

    // Encolar la promesa y solicitar nuevo token silenciosamente
    return new Promise<string>((resolve, reject) => {
      pendingRefreshRef.current.push({ resolve, reject });
      // prompt: '' indica que GIS no debe mostrar ningún diálogo al usuario
      tokenClientRef.current?.requestAccessToken({ prompt: '' });
    });
  }, [isTokenValid]);

  return (
    <AuthContext.Provider value={{ login, logout, refreshTokenSilently }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <GoogleAuthProvider>');
  return ctx;
}
