import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../lib/apiClient';

export type UserRole = 'student' | 'admin' | null;
export type UserTier = 'free' | 'pro';

interface AuthContextType {
  user: any; 
  role: UserRole;
  tier: UserTier;
  signIn: (email: string, password?: string) => Promise<boolean>;
  signUp: (email: string, password?: string, plan?: 'free' | 'pro', firstName?: string, lastName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [tier, setTier] = useState<UserTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('siteground_token');
        if (token) {
          const res = await apiFetch('/auth/session');
          if (res.user) {
            setUser({ id: res.user.id, email: res.user.email });
            setRole(res.user.email === 'admin@txglobal.com.au' ? 'admin' : 'student');
            setTier('pro');
          }
        }
      } catch (e) {
        localStorage.removeItem('siteground_token');
      } finally {
        setLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const signIn = async (email: string, password?: string) => {
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password: password || 'default' })
      });
      localStorage.setItem('siteground_token', res.token);
      setUser({ id: res.user.id, email: res.user.email });
      setRole(email === 'admin@txglobal.com.au' ? 'admin' : 'student');
      setTier('pro');
      return true;
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || 'Login failed');
    }
  };

  const signUp = async (email: string, password?: string, plan: 'free' | 'pro' = 'free', firstName?: string, lastName?: string) => {
    try {
      const res = await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password: password || 'default', firstName, lastName })
      });
      localStorage.setItem('siteground_token', res.token);
      setUser({ id: res.user.id, email: res.user.email });
      setRole('student');
      setTier('pro'); // Assuming pro for now
    } catch (e: any) {
      console.error(e);
      throw new Error(e.message || 'Signup failed');
    }
  };

  const signOut = async () => {
    localStorage.removeItem('siteground_token');
    setUser(null);
    setRole(null);
    setTier('free');
  };

  const resetPassword = async (email: string) => {
    // Requires email sending API which we might not have hooked up
    console.warn("Reset password not implemented for custom auth yet");
  };

  return (
    <AuthContext.Provider value={{ user, role, tier, signIn, signUp, signOut, resetPassword, loading }}>
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
