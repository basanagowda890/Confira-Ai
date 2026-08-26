import { useState } from "react";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, ShieldAlert, Sparkles } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";

const initialItems = [
  [CalendarDays, "Interview starting soon", "Basana Gowda's Frontend Developer interview starts in 18 minutes.", "10 min ago", "info"],
  [ShieldAlert, "Integrity alert needs review", "A tab switch was detected during Arjun Patel's interview session.", "32 min ago", "warning"],
  [Sparkles, "Top candidate identified", "Ananya Iyer has the highest current example score at 96%.", "1 hour ago", "success"],
  [CheckCircle2, "Interview completed", "Kavya Menon's Product Designer interview report is ready to review.", "Yesterday", "success"],
  [Bell, "New candidate added", "Rohan Singh was added to the AI/ML Engineer hiring pipeline.", "2 days ago", "info"]
];

export default function InterviewerNotifications() {
  const [items, setItems] = useState(initialItems);
  return <div><SectionTitle eyebrow="NOTIFICATIONS" title="Company notifications" description="Stay up to date with interviews, candidate analysis and hiring activity." action={<button className="btn btn-outline" onClick={() => setItems([])}>Mark all read</button>} />
    <div className="card notification-list">{items.length ? items.map(([Icon, title, text, time, tone]) => <div className={`notification-item ${tone}`} key={title}><span className="notification-icon"><Icon size={18}/></span><div><b>{title}</b><p>{text}</p><small>{time}</small></div></div>) : <div className="notification-empty"><CheckCircle2 size={22}/><b>All caught up</b><p>No new company notifications.</p></div>}</div>
  </div>;
}
