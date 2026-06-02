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
      if (adminSecret) {
        const validKey = await getAdminSecretKey();
        if (adminSecret !== validKey) {
          throw new Error('Invalid admin secret key');
        }
      }

      const email = `${username}@miaoda.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const userProfile = await getProfile(data.user.id);
        
        if (userProfile?.approval_status === 'pending') {
          await supabase.auth.signOut();
          throw new Error('Your account is pending approval by admin');
        }
        
        if (userProfile?.approval_status === 'rejected') {
          await supabase.auth.signOut();
          throw new Error('Your account has been rejected. Please contact administration');
        }

        if (adminSecret && userProfile?.role !== 'admin') {
          await supabase.auth.signOut();
          throw new Error('This account is not an admin account');
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, password: string, fullName: string, phone: string, email: string, address: string, departmentId: string, adminSecret?: string) => {
    try {
      if (adminSecret) {
        const validKey = await getAdminSecretKey();
        if (adminSecret !== validKey) {
          throw new Error('Invalid admin secret key');
        }
      }

      const emailAddress = `${username}@miaoda.com`;
      const { error } = await supabase.auth.signUp({
        email: emailAddress,
        password,
        options: {
          data: {
            username,
            full_name: fullName,
            phone,
            email,
            address,
            department_id: departmentId,
            role: adminSecret ? 'admin' : 'staff'
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

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';

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
      isStaff
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
