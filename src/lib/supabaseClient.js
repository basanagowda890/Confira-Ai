import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL || "";
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const url = rawUrl.trim().replace(/^['"]|['"]$/g, "");
const key = rawKey.trim().replace(/^['"]|['"]$/g, "");

export const supabase = url && key ? createClient(url, key) : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Authentication is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.");
  }
  return supabase;
}
