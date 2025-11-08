import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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

  const refreshUser = useCallback(async () => {
    console.log('refreshUser() started.');
    try {
      const response = await api.getCurrentUser();
      if (response.data) {
        setUser(response.data);
        console.log('refreshUser() finished. User state updated:', response.data.nickname);
      } else {
        setUser(null);
        console.log('refreshUser() finished. No user data received.');
      }
    } catch (error) {
      console.error('refreshUser() failed:', error);
      setUser(null);
    }
    console.log('refreshUser() completed.');
  }, []); // No dependencies - this function should be stable

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
    // Skip if auth callback is in progress (App.tsx will handle it)
    const urlParams = new URLSearchParams(window.location.search);
    const isAuthCallback = urlParams.has('auth') || urlParams.has('token');
    
    if (!isAuthCallback) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
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
