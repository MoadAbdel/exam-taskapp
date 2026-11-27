/**
 * Contexte d'authentification.
 *
 * La session vit dans un cookie httpOnly que JavaScript ne peut pas lire.
 * Au chargement, on demande donc a l'API qui est connecte (`GET /api/auth/me`).
 * Les composants lisent `user`, `loading`, `login`, `register` et `logout` via `useAuth()`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

/**
 * Fournit l'etat de session a toute l'application.
 * @param {{children: import('react').ReactNode}} props
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get('/auth/me')
      .then((res) => active && setUser(res.data.user))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    setUser(res.data.user);
  }, []);

  const register = useCallback(async (username, password) => {
    const res = await api.post('/auth/register', { username, password });
    setUser(res.data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, setUser }),
    [user, loading, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Acces au contexte d'authentification.
 * @returns {{user: {_id: string, username: string} | null, loading: boolean,
 *   login: Function, register: Function, logout: Function, setUser: Function}}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit etre utilise dans <AuthProvider>');
  return ctx;
}
