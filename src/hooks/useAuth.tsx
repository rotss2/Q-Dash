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

// Auto-login admin user
const AUTO_ADMIN: Profile = {
  id: '00000000-0000-0000-0000-000000000001',
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
