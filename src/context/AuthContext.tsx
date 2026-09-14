import { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, professional?: { role: string; specialty: string; credentials: string; registrationType?: string; documentNumber?: string; city?: string }, handle?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to fetch profile:", error.message);
      setProfile(null);
      return;
    }
    setProfile(data);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await supabase.rpc("touch_last_active", { p_user: session.user.id });
          await fetchProfile(session.user.id);
          setLoading(false);
        })();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        (async () => {
          await supabase.rpc("touch_last_active", { p_user: session.user.id });
          await fetchProfile(session.user.id);
        })();
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signUp(email: string, password: string, fullName: string, professional?: { role: string; specialty: string; credentials: string; registrationType?: string; documentNumber?: string; city?: string }, handle?: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const { error: rpcError } = await supabase.rpc("create_profile", {
        p_full_name: fullName,
        p_is_professional: !!professional,
        p_professional_role: professional?.role ?? null,
        p_specialty: professional?.specialty ?? null,
        p_credentials: professional?.credentials ?? null,
        p_registration_type: professional?.registrationType ?? "autonomo",
        p_document_number: professional?.documentNumber ?? null,
        p_location_city: professional?.city ?? null,
        p_handle: handle ?? null,
      });
      if (rpcError) return { error: rpcError.message };

      if (professional) {
        await supabase.from("professional_verification").insert({ user_id: data.user.id });
      }
    }
    return { error: null };
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  }

  async function refreshProfile() {
    if (user) {
      try {
        await fetchProfile(user.id);
      } catch (err) {
        console.error("Failed to refresh profile:", err);
      }
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
