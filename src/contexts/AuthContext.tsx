// Re-export everything from the canonical implementation.
// This ensures all pages importing from '@/contexts/AuthContext' share the
// same singleton AuthContext created in auth-context-instance.ts.
export { AuthProvider, useAuth, getProfile } from '@/features/auth/hooks/AuthContext';
export type { AuthContextType } from '@/contexts/auth-context-instance';
