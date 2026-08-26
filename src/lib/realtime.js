import { supabase } from "./supabaseClient";

export function subscribeToTable(table, filter, onChange) {
  if (!supabase) return () => {};
  const channel = supabase.channel(`realtime-${table}-${filter || "all"}-${Math.random().toString(36).slice(2)}`);
  const config = { event: "*", schema: "public", table };
  if (filter) config.filter = filter;
  channel.on("postgres_changes", config, onChange).subscribe();
  return () => { supabase.removeChannel(channel); };
}
