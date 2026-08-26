import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../lib/api";
import { requireSupabase, supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null); const [profile, setProfile] = useState(null); const [avatarUrl, setAvatarUrl] = useState(""); const [loading, setLoading] = useState(true);
  const refreshAvatar = async () => { try { const result = await api.get("/uploads/avatar"); setAvatarUrl(result.url); return result.url; } catch { setAvatarUrl(""); return ""; } };
  const refreshProfile = async () => { const result = await api.get("/auth/me"); setProfile(result.profile); await refreshAvatar(); return result.profile; };
  const updateProfile = async changes => { const result = await api.put("/profiles/me", changes); setProfile(result.data); return result.data; };
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;
      if (error) { setSession(null); setProfile(null); setAvatarUrl(""); setLoading(false); return; }
      setSession(data.session);
      if (data.session) try { await refreshProfile(); } catch { setProfile(null); }
      if (active) setLoading(false);
    };
    initialize();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (!next) { setProfile(null); setAvatarUrl(""); return; }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") refreshProfile().catch(() => setProfile(null));
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const login = async (email, password) => { const client = requireSupabase(); const { data, error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error; setSession(data.session); const next = await refreshProfile(); return next; };
  const register = async ({ email, password, fullName, role }) => { const client = requireSupabase(); const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName, requested_role: role } } }); if (error) throw error; if (data.session) { setSession(data.session); const current = await refreshProfile(); return { profile: current, confirmationRequired: false }; } return { confirmationRequired: true }; };
  const logout = async () => { if (supabase) await supabase.auth.signOut(); setSession(null); setProfile(null); setAvatarUrl(""); };
  return <AuthContext.Provider value={{ user: session?.user || null, session, profile, avatarUrl, loading, login, register, logout, refreshProfile, refreshAvatar, updateProfile }}>{children}</AuthContext.Provider>;
}
