import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'supervisor' | 'manager';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isManager: boolean;
  isSupervisor: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    let mounted = true;

    const safeSetLoading = (value: boolean) => {
      if (!mounted) return;
      setLoading(value);
    };

    const fetchAndSetProfile = (userId: string) => {
      // Important: ne pas appeler la DB directement dans onAuthStateChange
      setTimeout(() => {
        if (!mounted) return;
        fetchProfile(userId)
          .then((profileData) => {
            if (!mounted) return;
            setProfile(profileData);
          })
          .catch((err) => {
            console.error('[Auth] Error fetching profile:', err);
          });
      }, 0);
    };

    // Timeout de sécurité pour éviter le loading infini
    const timeout = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Loading timeout - forcing ready state');
        safeSetLoading(false);
      }
    }, 8000);

    // 1) Listener d'abord (évite de rater un event)
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
      }
    });

    // 2) Puis session initiale
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

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const isManager = profile?.role === 'manager';
  const isSupervisor = profile?.role === 'supervisor';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        isManager,
        isSupervisor,
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
