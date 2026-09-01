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
  const sessionRef = useRef(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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

  const refreshProfile = useCallback(async (activeSession = null) => {
    if (fetchingRef.current) return null;
    fetchingRef.current = true;
    const currentSession = activeSession || sessionRef.current;
    const currentUser = currentSession?.user || null;

    try {
      // 1. Try fetching profile through backend API
      try {
        const result = await api.get("/auth/me");
        if (result?.profile) {
          let freshAvatar = "";
          if (result.profile.avatar_url) {
            freshAvatar = await refreshAvatar().catch(() => "");
          }
          const merged = { ...result.profile, avatar_url: freshAvatar || result.profile.avatar_url || "" };
          setProfile(merged);
          return merged;
        }
      } catch {
        // Backend API might be booting or unreachable
      }

      // 2. Direct Supabase database fallback if available
      if (supabase && currentUser?.id) {
        try {
          const { data: sbProfile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .maybeSingle();

          if (sbProfile) {
            setProfile(sbProfile);
            return sbProfile;
          }
        } catch {
          // Direct DB query failed
        }
      }

      // 3. Fallback to Supabase User Metadata if profile row hasn't populated yet
      if (currentUser) {
        const fallbackProfile = {
          id: currentUser.id,
          email: currentUser.email || "",
          full_name: currentUser.user_metadata?.full_name || "",
          role: currentUser.user_metadata?.requested_role || "candidate",
          avatar_url: ""
        };
        setProfile(fallbackProfile);
        return fallbackProfile;
      }

      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, [refreshAvatar]);

  const updateProfile = useCallback(async (changes) => {
    try {
      const result = await api.put("/profiles/me", changes);
      const updated = result?.data || result;
      setProfile(prev => ({ ...prev, ...updated }));
      return updated;
    } catch (err) {
      if (supabase && sessionRef.current?.user?.id) {
        try {
          const { data } = await supabase
            .from("profiles")
            .update(changes)
            .eq("id", sessionRef.current.user.id)
            .select()
            .maybeSingle();
          if (data) {
            setProfile(prev => ({ ...prev, ...data }));
            return data;
          }
        } catch {}
      }
      throw err;
    }
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

        sessionRef.current = data.session;
        setSession(data.session);
        await refreshProfile(data.session);
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
      sessionRef.current = nextSession;
      setSession(nextSession);

      if (!nextSession) {
        setProfile(null);
        setAvatarUrl("");
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        await refreshProfile(nextSession);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [refreshProfile]);

  const login = async (email, password) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data?.user) {
      throw new Error("Authentication failed: No user returned.");
    }
    sessionRef.current = data.session;
    setSession(data.session);
    const resolvedProfile = await refreshProfile(data.session);
    const finalProfile = resolvedProfile || {
      id: data.user.id,
      email: data.user.email || email,
      full_name: data.user.user_metadata?.full_name || "",
      role: data.user.user_metadata?.requested_role || "candidate",
      avatar_url: ""
    };
    if (!resolvedProfile) {
      setProfile(finalProfile);
    }
    return {
      session: data.session,
      user: data.user,
      profile: finalProfile,
      confirmationRequired: false
    };
  };

  const register = async ({ email, password, fullName, role }) => {
    const client = requireSupabase();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, requested_role: role } }
    });
    if (error) throw error;
    if (data?.session && data?.user) {
      sessionRef.current = data.session;
      setSession(data.session);
      const current = await refreshProfile(data.session);
      const finalProfile = current || {
        id: data.user.id,
        email: data.user.email || email,
        full_name: fullName || data.user.user_metadata?.full_name || "",
        role: role || data.user.user_metadata?.requested_role || "candidate",
        avatar_url: ""
      };
      if (!current) setProfile(finalProfile);
      return {
        session: data.session,
        user: data.user,
        profile: finalProfile,
        confirmationRequired: false
      };
    }
    return {
      session: null,
      user: data?.user || null,
      profile: null,
      confirmationRequired: true
    };
  };

  const logout = async () => {
    if (supabase) {
      try { await supabase.auth.signOut(); } catch {}
    }
    sessionRef.current = null;
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
