import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, Member } from '../services/api';

interface AuthContextType {
  user: Member | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await api.getCurrentUser();
      if (response.data) {
        setUser(response.data);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    }
  };

  const login = async () => {
    try {
      const response = await api.login();
      if (response.data?.authUrl) {
        // Redirect to OIDC provider
        window.location.href = response.data.authUrl;
      } else {
        throw new Error(response.error || 'Failed to initiate login');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear user anyway
      setUser(null);
    }
  };

  useEffect(() => {
    // Check if user is logged in on mount
    refreshUser().finally(() => setLoading(false));

    // Handle OIDC callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) {
      // This is an OIDC callback, refresh user data
      setTimeout(() => {
        refreshUser();
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 1000);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
