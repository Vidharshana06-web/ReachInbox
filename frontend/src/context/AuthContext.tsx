import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { authAPI } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  loginWithGoogle: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    const token = localStorage.getItem('reachinbox_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await authAPI.getMe();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to fetch authenticated user profile:', error);
      // If unauthorized, clear local token
      localStorage.removeItem('reachinbox_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const loginWithGoogle = () => {
    const redirectUrl = authAPI.getGoogleAuthUrl();
    window.location.href = redirectUrl;
  };

  const logout = () => {
    localStorage.removeItem('reachinbox_token');
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
