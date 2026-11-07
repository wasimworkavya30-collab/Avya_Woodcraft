import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  const loadSession = useCallback(async () => {
    if (!getToken()) {
      setSession(null);
      setReady(true);
      return;
    }
    try {
      const me = await api.get('/auth/me');
      setSession(me);
    } catch {
      setToken('');
      setSession(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadSession();
    const handler = () => setSession(null);
    window.addEventListener('avya:session-expired', handler);
    return () => window.removeEventListener('avya:session-expired', handler);
  }, [loadSession]);

  const login = useCallback(async (payload) => {
    const result = await api.post('/auth/login', payload);
    setToken(result.token);
    setSession(
      result.admin
        ? { role: 'admin', admin: result.admin }
        : { role: 'employee', employee: result.employee },
    );
    return result;
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, ready, login, logout, refresh: loadSession }),
    [session, ready, login, logout, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
};
