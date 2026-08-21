import type { Session, User } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { LeagueSupabaseClient } from '../lib/supabase';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  captcha: { enabled: boolean; turnstileSiteKey: string | null };
  requestPasswordRecovery: (email: string, captchaToken: string | null) => Promise<void>;
  signIn: (email: string, password: string, captchaToken: string | null) => Promise<void>;
  signUp: (email: string, password: string, captchaToken: string | null) => Promise<'signed-in' | 'confirmation-required'>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ captcha, client, children }: PropsWithChildren<{
  captcha: AuthContextValue['captcha'];
  client: LeagueSupabaseClient;
}>) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError('Die Sitzung konnte nicht sicher geprüft werden.');
      setSession(sessionError ? null : data.session);
      setLoading(false);
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [client]);

  const captchaOptions = (captchaToken: string | null) => {
    if (!captcha.enabled) return {};
    if (!captchaToken) throw new Error('Captcha token required.');
    return { captchaToken };
  };

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    error,
    captcha,
    requestPasswordRecovery: async (email, captchaToken) => {
      const { error: recoveryError } = await client.auth.resetPasswordForEmail(email, {
        ...captchaOptions(captchaToken),
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (recoveryError) throw recoveryError;
    },
    signIn: async (email, password, captchaToken) => {
      const { error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
        options: captchaOptions(captchaToken),
      });
      if (signInError) throw signInError;
    },
    signUp: async (email, password, captchaToken) => {
      const { data, error: signUpError } = await client.auth.signUp({
        email,
        password,
        options: {
          ...captchaOptions(captchaToken),
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (signUpError) throw signUpError;
      return data.session ? 'signed-in' : 'confirmation-required';
    },
    signOut: async () => {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) throw signOutError;
    },
    updateDisplayName: async (displayName) => {
      const { error: updateError } = await client.auth.updateUser({
        data: { display_name: displayName },
      });
      if (updateError) throw updateError;
    },
    updatePassword: async (password) => {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw updateError;
    },
  }), [captcha, client, error, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

