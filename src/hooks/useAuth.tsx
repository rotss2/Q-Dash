import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Profile, UserRole } from '../types';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, role: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auto-login admin user (real Supabase user)
const AUTO_ADMIN: Profile = {
  id: 'c6ae1256-0bda-4a98-8fcc-8765446f9d32',
  email: 'admin@qdash.app',
  role: 'admin',
  created_at: new Date().toISOString()
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(AUTO_ADMIN);
  const [loading] = useState(false);

  // Auto-login as admin - no actual auth needed
  useEffect(() => {
    setUser(AUTO_ADMIN);
  }, []);

  const signIn = async () => {
    setUser(AUTO_ADMIN);
    return { error: null };
  };

  const signUp = async () => {
    setUser(AUTO_ADMIN);
    return { error: null };
  };

  const signOut = async () => {
    // Do nothing - always stay logged in as admin
    setUser(AUTO_ADMIN);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
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
