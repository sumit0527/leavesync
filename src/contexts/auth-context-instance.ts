// IMPORTANT: This file intentionally has zero dependencies beyond React.
// Keeping createContext() here ensures the context object identity is stable
// across every HMR cycle — re-evaluating AuthContext.tsx (or any of its deps)
// will never produce a new context object, eliminating the
// "useAuth must be used within an AuthProvider" HMR mismatch.
import { createContext } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string, adminSecret?: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string, fullName: string, phone: string, email: string, address: string, departmentId: string, adminSecret?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isStaff: boolean;
  isViewer: boolean;
  isManagementUser: boolean;
}

// Singleton context — created once, never re-created
export const AuthContext = createContext<AuthContextType | undefined>(undefined);
