import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AppConfig, OnlineGameState, PublicUser } from '../types/chess';

interface AuthContextValue {
  user: PublicUser | null;
  token: string | null;
  loading: boolean;
  appConfig: AppConfig;
  ownerSetup: { claimed: boolean; envConfigured: boolean };
  wsConnected: boolean;
  onlineCount: number;
  lobbyGames: OnlineGameState[];
  queueSize: number;
  activeOnlineGame: OnlineGameState | null;
  incomingChallenge: { gameId: string; inviteCode: string; fromUsername: string; timeControl: { label: string } } | null;
  dismissChallenge: () => void;
  setActiveOnlineGame: React.Dispatch<React.SetStateAction<OnlineGameState | null>>;
  sendWs: (type: string, payload?: Record<string, unknown>) => void;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  refreshAuth: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  setSession: (user: PublicUser | null, token: string | null) => void;
  logout: () => Promise<void>;
}

const DEFAULT_CONFIG: AppConfig = {
  appName: 'CART3R Chess Academy',
  announcement: '',
  maintenanceMode: false,
  features: {
    stockfishEnabled: true,
    onlineEnabled: true,
    tournamentsEnabled: true,
    coachEnabled: true,
    puzzlesEnabled: true,
    mirrorBotEnabled: true,
  },
  maxEngineDepth: 10,
  enabledBoardThemes: [
    'wooden', 'green', 'blue', 'marble', 'dark', 'gold', 'purple', 'glass', 'galaxy', 'neon', 'cyberpunk', 'minimalist', 'custom',
  ],
  enabledSoundPacks: ['wood', 'glass', 'digital', 'silent'],
  version: '1.0.0',
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [ownerSetup, setOwnerSetup] = useState({ claimed: true, envConfigured: false });

  const [wsConnected, setWsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [lobbyGames, setLobbyGames] = useState<OnlineGameState[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [activeOnlineGame, setActiveOnlineGame] = useState<OnlineGameState | null>(null);
  const [incomingChallenge, setIncomingChallenge] = useState<{
    gameId: string;
    inviteCode: string;
    fromUsername: string;
    timeControl: { label: string };
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const apiFetch = useCallback(async <T = unknown,>(url: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers || {});
    if (tokenRef.current && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${tokenRef.current}`);
    }
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(url, { ...init, headers, credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data as T;
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await fetch('/api/config').then((r) => r.json());
      if (cfg && cfg.appName) setAppConfig(cfg);
    } catch {
      // Offline fallback keeps cached config
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const [meRes, setupRes] = await Promise.all([
        apiFetch<{ user: PublicUser | null; token?: string }>('/api/auth/me'),
        fetch('/api/auth/owner-setup-status').then((r) => r.json()),
      ]);
      setUser(meRes.user);
      if (meRes.token) setToken(meRes.token);
      if (setupRes && typeof setupRes.claimed === 'boolean') {
        setOwnerSetup({ claimed: setupRes.claimed, envConfigured: Boolean(setupRes.envConfigured) });
      }
    } catch {
      // Offline or unauthenticated
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    refreshConfig();
    refreshAuth();
  }, [refreshConfig, refreshAuth]);

  const sendWs = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  useEffect(() => {
    let closedByCleanup = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        if (tokenRef.current) {
          ws.send(JSON.stringify({ type: 'auth', payload: { token: tokenRef.current } }));
        }
      };

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'lobby:update') {
            setOnlineCount(msg.payload.onlineCount || 0);
            setLobbyGames(msg.payload.games || []);
            setQueueSize(msg.payload.queueSize || 0);
          } else if (
            msg.type === 'game:matched' ||
            msg.type === 'game:created' ||
            msg.type === 'game:state'
          ) {
            setActiveOnlineGame(msg.payload);
          } else if (msg.type === 'challenge:received') {
            setIncomingChallenge(msg.payload);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        if (!closedByCleanup) {
          reconnectTimer = setTimeout(connect, 2500);
        }
      };
    };

    connect();
    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  // Re-authenticate WS whenever token changes
  useEffect(() => {
    if (token && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'auth', payload: { token } }));
    }
  }, [token]);

  const setSession = useCallback((nextUser: PublicUser | null, nextToken: string | null) => {
    setUser(nextUser);
    setToken(nextToken);
    if (nextToken && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'auth', payload: { token: nextToken } }));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        appConfig,
        ownerSetup,
        wsConnected,
        onlineCount,
        lobbyGames,
        queueSize,
        activeOnlineGame,
        incomingChallenge,
        dismissChallenge: () => setIncomingChallenge(null),
        setActiveOnlineGame,
        sendWs,
        apiFetch,
        refreshAuth,
        refreshConfig,
        setSession,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
