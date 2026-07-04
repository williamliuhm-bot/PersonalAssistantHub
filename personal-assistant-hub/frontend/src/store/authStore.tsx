import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { authApi, type User, type LoginRequest, type RegisterRequest } from '../api/auth';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
    const me = await authApi.getMe();
    setUser(me.data);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('refresh_token', response.data.refresh_token);
    const me = await authApi.getMe();
    setUser(me.data);
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('refresh_token') || '';
    const accessToken = localStorage.getItem('access_token') || '';
    if (refreshToken) authApi.logout(refreshToken).catch(() => {});
    if (accessToken) authApi.logout(accessToken).catch(() => {});
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const response = await authApi.getMe();
      setUser(response.data);
    } catch {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await authApi.refresh(refreshToken);
          localStorage.setItem('access_token', data.access_token);
          const response = await authApi.getMe();
          setUser(response.data);
          setIsLoading(false);
          return;
        } catch {
          // fall through to clear session
        }
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
    }
    setIsLoading(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
