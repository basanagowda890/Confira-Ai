import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { api } from "../lib/api";
import { requireSupabase, supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);

  const refreshAvatar = useCallback(async () => {
    try {
      const result = await api.get("/uploads/avatar");
      const base = result?.url || "";
      const url = base ? `${base}${base.includes("?") ? "&" : "?"}_t=${Date.now()}` : "";
      setAvatarUrl(url);
      setProfile(prev => prev ? ({ ...prev, avatar_url: url }) : prev);
      return url;
    } catch {
      setAvatarUrl("");
      setProfile(prev => prev ? ({ ...prev, avatar_url: "" }) : prev);
      return "";
    }
  }, []);

  const setDirectAvatar = useCallback((url) => {
    setAvatarUrl(url);
    setProfile(prev => prev ? ({ ...prev, avatar_url: url }) : prev);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    try {
      const result = await api.get("/auth/me");
      const userProfile = result?.profile || null;
      let freshAvatar = "";
      if (userProfile?.avatar_url) {
        freshAvatar = await refreshAvatar();
      }
      const merged = userProfile ? { ...userProfile, avatar_url: freshAvatar || userProfile.avatar_url } : null;
      setProfile(merged);
      return merged;
    } catch (err) {
      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, [refreshAvatar]);

  const updateProfile = useCallback(async (changes) => {
    const result = await api.put("/profiles/me", changes);
    const updated = result?.data || result;
    setProfile(prev => ({ ...prev, ...updated }));
    return updated;
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    const initialize = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error || !data?.session) {
          setSession(null);
          setProfile(null);
          setAvatarUrl("");
          setLoading(false);
          return;
        }

        setSession(data.session);
        await refreshProfile();
      } catch {
        if (active) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!active) return;
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setAvatarUrl("");
        return;
      }

      if (event === "SIGNED_IN" && !profile) {
        await refreshProfile();
      }
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [refreshProfile, profile]);

  const login = async (email, password) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSession(data.session);
    const next = await refreshProfile();
    return next;
  };

  const register = async ({ email, password, fullName, role }) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, requested_role: role } }
    });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      const current = await refreshProfile();
      return { profile: current, confirmationRequired: false };
    }
    return { confirmationRequired: true };
  };

  const logout = async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    setSession(null);
    setProfile(null);
    setAvatarUrl("");
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user || null,
        session,
        profile,
        avatarUrl,
        loading,
        login,
        register,
        logout,
        refreshProfile,
        refreshAvatar,
        setDirectAvatar,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
