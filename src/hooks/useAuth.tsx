import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  profile: { full_name: string; email: string; avatar_url?: string; phone?: string } | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthCtx = createContext<AuthContext | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<AuthContext["profile"]>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserMeta(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserMeta(session.user.id);
      else { setIsAdmin(false); setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserMeta(userId: string) {
    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, avatar_url, phone").eq("id", userId).single(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(profileData ?? null);
    setIsAdmin(roleData?.some((r) => r.role === "admin") ?? false);
    setLoading(false);
  }

  const signIn  = async (e: string, p: string) => { const { error } = await supabase.auth.signInWithPassword({ email: e, password: p }); return { error: error as Error | null }; };
  const signUp  = async (e: string, p: string, n: string) => { const { error } = await supabase.auth.signUp({ email: e, password: p, options: { data: { full_name: n } } }); return { error: error as Error | null }; };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthCtx.Provider value={{ user, session, loading, isAdmin, profile, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
