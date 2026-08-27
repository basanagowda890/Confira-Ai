import { supabase } from "./supabaseClient";

export function subscribeToTable(table, filterOrChange, onChange) {
  if (!supabase) return () => {};
  
  const filter = typeof filterOrChange === "string" ? filterOrChange : null;
  const callback = typeof filterOrChange === "function" ? filterOrChange : onChange;
  if (!callback || typeof callback !== "function") return () => {};

  const channelName = `realtime-${table}-${filter || "all"}-${Math.random().toString(36).slice(2)}`;
  const channel = supabase.channel(channelName);
  const config = { event: "*", schema: "public", table };
  if (filter) config.filter = filter;

  channel.on("postgres_changes", config, payload => {
    try {
      callback(payload);
    } catch (e) {
      console.warn("Realtime callback error:", e);
    }
  }).subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {}
  };
}
