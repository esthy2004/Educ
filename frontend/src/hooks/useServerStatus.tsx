import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ServerStatus } from '@/types';
import { API_URL, pingServer } from '@/services/api';

interface ServerStatusContextValue {
  status: ServerStatus;
  check: () => Promise<void>;
}

const ServerStatusContext = createContext<ServerStatusContextValue | null>(null);

export function ServerStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ServerStatus>({
    mode: 'local',
    apiUrl: API_URL,
    latency: null,
    lastCheck: null,
    checking: true,
  });

  const check = useCallback(async () => {
    setStatus((current) => ({ ...current, checking: true }));
    const result = await pingServer();
    setStatus({
      mode: result.online ? 'online' : navigator.onLine ? 'local' : 'offline',
      apiUrl: API_URL,
      latency: result.latency,
      lastCheck: new Date().toISOString(),
      checking: false,
    });
  }, []);

  useEffect(() => {
    void check();
    const interval = window.setInterval(() => void check(), 30000);
    const onOnline = () => void check();
    const onOffline = () =>
      setStatus((current) => ({ ...current, mode: 'offline', checking: false, latency: null }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [check]);

  const value = useMemo(() => ({ status, check }), [status, check]);
  return <ServerStatusContext.Provider value={value}>{children}</ServerStatusContext.Provider>;
}

export function useServerStatus(): ServerStatusContextValue {
  const context = useContext(ServerStatusContext);
  if (!context) throw new Error('useServerStatus doit être utilisé dans ServerStatusProvider.');
  return context;
}
