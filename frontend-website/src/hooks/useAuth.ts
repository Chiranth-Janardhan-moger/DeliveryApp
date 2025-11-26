import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { wsClient } from '@/lib/websocket';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = api.getToken();
      if (token) {
        const userData = await api.getCurrentUser();
        setUser(userData);
        
        // Connect WebSocket
        wsClient.connect(userData.id);
        
        // Listen for force logout
        wsClient.on('FORCE_LOGOUT', () => {
          logout();
          window.location.href = '/login';
        });
      }
    } catch (err: any) {
      console.error('Auth check failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const login = async (emailOrPhone: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.login(emailOrPhone, password);
      setUser(data.user);
      
      // Connect WebSocket
      wsClient.connect(data.user.id);
      
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    api.logout();
    wsClient.disconnect();
    setUser(null);
  };

  return {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isDriver: user?.role === 'driver',
  };
}
