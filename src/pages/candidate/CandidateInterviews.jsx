import { CalendarDays, Clock3, Video, ArrowRight, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function CandidateInterviews() {
  const [filter, setFilter] = useState("All");
  const [interviews, setInterviews] = useState([]);
  useEffect(() => {
    const load = () => api.get("/interviews").then(result => setInterviews(result.data || [])).catch(() => setInterviews([]));
    load();
    return subscribeToTable("interviews", null, load);
  }, []);
  const visible = interviews.filter(i => filter === "All" || (filter === "Practice" ? i.type === "practice" : i.status === filter.toLowerCase()));
  return <div>
    <SectionTitle eyebrow="INTERVIEWS" title="My Interviews" description="Upcoming, live and completed sessions. Join a live interview when the interviewer opens the room." />
    <div className="filter-row">
      {["All", "Upcoming", "Completed", "Practice"].map(item => <button key={item} className={`filter ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}
    </div>
    <div className="interview-list">
      {visible.map(i => {
        const live = i.status === "live";
        const date = new Date(i.scheduled_at);
        const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const timeLabel = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
        return <div className={`card interview-row ${live ? "interview-live-row" : ""}`} key={i.id}>
          <div className="date-tile small"><b>{date.getDate()}</b><span>{date.toLocaleDateString("en-US", { month: "short" })}</span></div>
          <div className="interview-info">
            <div className="interview-title-line"><h3>{i.title}</h3>{live && <Badge tone="danger"><span className="live-dot" /> Live room open</Badge>}</div>
            <p>{i.jobs?.title || "Interview"}</p>
            <div className="meta-row"><span><CalendarDays size={14}/>{dateLabel}</span><span><Clock3 size={14}/>{timeLabel}</span><span><Video size={14}/>{i.duration_minutes} min</span></div>
          </div>
          <Badge tone={i.status === "completed" ? "success" : "info"}>{i.status}</Badge>
          {live ? <Link className="btn btn-primary join-btn" to={`/candidate/live?interview=${i.id}`}><Radio size={15}/> Join interview</Link>
            : i.status === "scheduled" ? <Link className="btn btn-outline" to={`/candidate/instructions?interview=${i.id}`}>Prepare <ArrowRight size={15}/></Link>
            : <Link className="btn btn-outline" to="/candidate/results">View</Link>}
        </div>;
      })}
    </div>
    {!visible.length && <p className="empty-state">No {filter.toLowerCase()} interviews found.</p>}
    <div className="candidate-join-note"><Radio size={18}/><div><b>Joining a live interview</b><p>When the interviewer starts the room, the Join interview button opens your camera, microphone, screen-share and interview workspace.</p></div></div>
  </div>;
}