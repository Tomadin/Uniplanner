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

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: GisTokenClientConfig) => GisTokenClient;
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
  const { setUser, setAccessToken, clearAuth, isTokenValid } = useAuthStore();

  const tokenClientRef = useRef<GisTokenClient | null>(null);
  // Cola de promesas pendientes de refresh
  const pendingRefreshRef = useRef<Array<{
    resolve: (token: string) => void;
    reject: (err: Error) => void;
  }>>([]);

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

      // Obtener perfil del usuario en paralelo, sin bloquear el token
      fetchUserInfo(response.access_token).catch(console.warn);

      // Resolver todas las promesas pendientes de refresh
      pendingRefreshRef.current.forEach(({ resolve }) => resolve(response.access_token));
      pendingRefreshRef.current = [];
    },
    [setAccessToken, fetchUserInfo],
  );

  // Carga el script de GIS e inicializa el cliente de tokens
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('[Auth] VITE_GOOGLE_CLIENT_ID no está configurado en .env');
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
        },
      });
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
