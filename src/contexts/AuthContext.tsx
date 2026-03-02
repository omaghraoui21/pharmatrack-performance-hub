import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type UserRole = 'supervisor' | 'manager';
type AppRole = 'super_admin' | 'admin_site' | 'manager_unite' | 'superviseur' | 'readonly';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  unit_id?: string | null;
  is_active?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  appRoles: AppRole[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isManager: boolean;
  isSupervisor: boolean;
  isSuperAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appRoles, setAppRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const performSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setAppRoles([]);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Erreur lors du chargement du profil:', error);
      return null;
    }

    return data as Profile;
  };

  const fetchUserRoles = async (userId: string): Promise<AppRole[]> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Erreur lors du chargement des rôles:', error);
        return [];
      }

      return (data?.map(r => r.role as AppRole) || []);
    } catch (err) {
      console.error('Exception lors du chargement des rôles:', err);
      return [];
    }
  };

  useEffect(() => {
    let mounted = true;

    const safeSetLoading = (value: boolean) => {
      if (!mounted) return;
      setLoading(value);
    };

    const fetchAndSetProfile = (userId: string) => {
      setTimeout(() => {
        if (!mounted) return;
        
        Promise.all([
          fetchProfile(userId),
          fetchUserRoles(userId)
        ])
          .then(([profileData, roles]) => {
            if (!mounted) return;

            // Block inactive accounts
            if (profileData && profileData.is_active === false) {
              toast.error('Votre compte est désactivé. Contactez votre administrateur.');
              performSignOut();
              return;
            }

            setProfile(profileData);
            setAppRoles(roles);
          })
          .catch((err) => {
            console.error('[Auth] Error fetching profile/roles:', err);
          });
      }, 0);
    };

    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Loading timeout - forcing ready state');
        safeSetLoading(false);
      }
    }, 8000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user ?? null);
      safeSetLoading(false);

      if (session?.user) {
        fetchAndSetProfile(session.user.id);
      } else {
        setProfile(null);
        setAppRoles([]);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        safeSetLoading(false);

        if (session?.user) {
          fetchAndSetProfile(session.user.id);
        } else {
          setProfile(null);
          setAppRoles([]);
        }
      })
      .catch((err) => {
        console.error('[Auth] Error getting session:', err);
        safeSetLoading(false);
      });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = performSignOut;

  const isManager = profile?.role === 'manager';
  const isSupervisor = profile?.role === 'supervisor';
  const isSuperAdmin = appRoles.includes('super_admin');
  const hasRole = (role: AppRole) => appRoles.includes(role);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        appRoles,
        loading,
        signIn,
        signOut,
        isManager,
        isSupervisor,
        isSuperAdmin,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
}
