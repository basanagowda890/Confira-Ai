import { Bell, CalendarDays, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function CandidateNotifications() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const load = () => api.get("/notifications").then(result => setItems(result.data || [])).catch(() => setItems([]));
    load();
    return subscribeToTable("notifications", null, load);
  }, []);
  return <div><SectionTitle eyebrow="NOTIFICATIONS" title="Notifications" description="Important updates about your interviews and profile." /><div className="card notification-list">{items.map(item=><div className="notification-item" key={item.id}><span className="notification-icon"><Bell size={18}/></span><div><b>{item.title}</b><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()}</small></div></div>)}{!items.length && <p className="empty-state">No notifications yet.</p>}</div></div>;
}