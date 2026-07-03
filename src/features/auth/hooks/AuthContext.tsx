// @refresh reset
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';
import { toast } from 'sonner';
import { AuthContext } from '@/contexts/auth-context-instance';

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch user profile:', error);
    return null;
  }
  return data;
}



async function getAdminSecretKey(): Promise<string> {
  const { data } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'admin_secret_key')
    .maybeSingle();
  return data?.value ?? 'GDS2026ADMIN';
}

function cleanUsername(value: string): string {
  return value.trim().toLowerCase();
}

function toInternalAuthEmail(username: string): string {
  return `${cleanUsername(username)}@miaoda.com`;
}

async function resolveLoginEmail(loginId: string): Promise<string> {
  const cleaned = cleanUsername(loginId);

  // LeaveSync uses Supabase Auth email/password under the hood.
  // For normal usernames, the auth email is username@miaoda.com.
  if (!cleaned.includes('@')) {
    return toInternalAuthEmail(cleaned);
  }

  // If the user types their real registered email, find the linked username first.
  const { data: profileByRealEmail } = await supabase
    .from('profiles')
    .select('username')
    .ilike('email', cleaned)
    .maybeSingle();

  if (profileByRealEmail?.username) {
    return toInternalAuthEmail(profileByRealEmail.username);
  }

  // Fallback: support accounts that may have been created directly in Supabase Auth
  // using a real email address.
  return cleaned;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileData = await getProfile(user.id);
    setProfile(profileData);
  };

  useEffect(() => {
    supabase
      .auth
      .getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          getProfile(session.user.id).then(setProfile);
        }
      })
      .catch(error => {
        toast.error(`Failed to fetch user info: ${error.message}`);
      })
      .finally(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        getProfile(session.user.id).then(setProfile);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithUsername = async (username: string, password: string, adminSecret?: string) => {
    try {
      const loginId = cleanUsername(username);

      if (adminSecret) {
        const validKey = await getAdminSecretKey();
        if (adminSecret.trim() !== validKey) {
          throw new Error('Invalid admin secret key');
        }
      }

      const email = await resolveLoginEmail(loginId);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Invalid username/email or password. Use the same username you used while registering.');
        }
        throw error;
      }

      if (data.user) {
        const userProfile = await getProfile(data.user.id);

        if (!userProfile) {
          await supabase.auth.signOut();
          throw new Error('Login succeeded but profile was not found. Please contact admin.');
        }

        if (userProfile.approval_status === 'pending') {
          await supabase.auth.signOut();
          throw new Error(userProfile.role === 'staff' ? 'Your account is pending approval by Principal' : ['principal', 'admin'].includes(userProfile.role) ? 'Your account is pending approval by Director' : 'Your account is pending approval');
        }
        
        if (userProfile.approval_status === 'rejected') {
          await supabase.auth.signOut();
          throw new Error(userProfile.role === 'staff' ? 'Your account has been rejected. Please contact Principal office' : ['principal', 'admin'].includes(userProfile.role) ? 'Your account has been rejected. Please contact Director office' : 'Your account has been rejected');
        }

        if (adminSecret && !['admin', 'principal', 'main_admin', 'director', 'viewer'].includes(userProfile.role)) {
          await supabase.auth.signOut();
          throw new Error('This account is not a principal/director/viewer account');
        }

        if (!adminSecret && userProfile.role !== 'staff') {
          await supabase.auth.signOut();
          throw new Error('This account is not a staff account. Please use Management Login.');
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string, fullName: string, phone: string, email: string, address: string, departmentId: string, adminSecret?: string, requestedRole?: 'staff' | 'admin' | 'principal' | 'main_admin' | 'director', options?: { collegeUnit?: 'junior' | 'senior' | 'pharmacy'; adminDesignation?: 'principal' | 'uh' }) => {
    try {
      const cleanedUsername = cleanUsername(username);
      const cleanedEmail = email.trim().toLowerCase();
      const cleanedPhone = phone.replace(/\s/g, '');

      if (adminSecret) {
        const validKey = await getAdminSecretKey();
        if (adminSecret.trim() !== validKey) {
          throw new Error('Invalid admin secret key');
        }
      }

      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanedUsername)
        .maybeSingle();

      if (existingUsername) {
        throw new Error('This username is already taken. Please choose another username.');
      }

      const emailAddress = toInternalAuthEmail(cleanedUsername);
      const { error } = await supabase.auth.signUp({
        email: emailAddress,
        password,
        options: {
          data: {
            username: cleanedUsername,
            full_name: fullName.trim(),
            phone: cleanedPhone,
            email: cleanedEmail,
            address: address.trim(),
            department_id: departmentId,
            role: adminSecret ? (requestedRole ?? 'admin') : 'staff',
            college_unit: options?.collegeUnit ?? null,
            admin_designation: adminSecret ? (options?.adminDesignation ?? 'principal') : null
          }
        }
      });

      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  // Transition-safe role helpers:
  // Transition-safe role helpers:
  // - Legacy DB role 'admin' is treated as Principal / UH.
  // - Legacy DB role 'main_admin' is treated as Director.
  // - New clean DB roles are 'principal' and 'director'.
  const isLegacyAdmin = profile?.role === 'admin';
  const isPrincipal = profile?.role === 'principal' || profile?.role === 'admin';
  const isMainAdmin = profile?.role === 'director' || profile?.role === 'main_admin';
  const isAdmin = isPrincipal || isMainAdmin;
  const isStaff = profile?.role === 'staff';
  const isViewer = profile?.role === 'viewer';
  const isManagementUser = isAdmin || isViewer;

  const portalRoleLabel = isViewer
    ? 'Viewer'
    : isMainAdmin
      ? 'Director'
      : isPrincipal
        ? 'Principal / UH'
        : isStaff
          ? 'Staff'
          : 'User';

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      signInWithUsername, 
      signUpWithUsername, 
      signOut, 
      refreshProfile,
      isAdmin,
      isStaff,
      isViewer,
      isPrincipal,
      isMainAdmin,
      isLegacyAdmin,
      isManagementUser,
      portalRoleLabel
    }}>
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
