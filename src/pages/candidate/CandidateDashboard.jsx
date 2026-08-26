import { ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import StatCard from "../../components/StatCard";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

export default function CandidateDashboard() {
  const { profile } = useAuth();
  const name = profile?.full_name || "Candidate";
  const [data, setData] = useState(null);
  const [interviews, setInterviews] = useState([]);
  useEffect(() => { Promise.all([api.get("/candidate/dashboard"), api.get("/interviews")]).then(([dashboard, interviewResult]) => { setData(dashboard.data); setInterviews(interviewResult.data || []); }).catch(() => {}); }, []);
  const upcoming = interviews.find(item => item.status === "scheduled" || item.status === "live");
  const completed = interviews.filter(item => item.status === "completed");
  const upcomingDate = upcoming ? new Date(upcoming.scheduled_at) : null;

  return <div>
    <SectionTitle eyebrow="CANDIDATE SPACE" title={`Welcome back, ${name}`} description="Your interview journey at a glance." action={<Link className="btn btn-primary" to="/candidate/profile">Complete profile <ArrowRight size={16} /></Link>} />
    <div className="stats-grid">
      <StatCard icon={CalendarDays} value={data?.upcoming_interviews?.length ?? (upcoming ? 1 : 0)} label="Upcoming interviews" />
      <StatCard icon={CheckCircle2} value={data?.completed_interviews?.length ?? completed.length} label="Completed interviews" />
      <StatCard icon={Sparkles} value="—" label="Average performance" hint="Results will appear here" tone="success" />
      <StatCard icon={FileText} value={profile?.resume_path ? "Ready" : "—"} label="Resume status" hint="Keep your profile complete" />
    </div>

    <div className="dashboard-grid">
      <section className="card">
        <div className="card-head"><div><h3>Next interview</h3><p>Your upcoming session</p></div>{upcoming && <Badge tone={upcoming.status === "live" ? "danger" : "success"}>{upcoming.status}</Badge>}</div>
        {upcoming && upcomingDate ? <div className="interview-hero"><div className="date-tile"><b>{upcomingDate.getDate()}</b><span>{upcomingDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span></div><div><h3>{upcoming.title}</h3><p>{upcoming.type} · {upcoming.duration_minutes} minutes</p><span className="muted">{upcomingDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · Online</span></div><Link className="btn btn-primary" to={`/candidate/live?interview=${upcoming.id}`}>{upcoming.status === "live" ? "Join interview" : "View interview"} <ArrowRight size={16} /></Link></div> : <p className="empty-state">No upcoming interviews.</p>}
      </section>

      <section className="card">
        <div className="card-head"><div><h3>Profile readiness</h3><p>Improve your hiring profile</p></div><b>{data?.profile_completion ?? 0}%</b></div>
        <ProgressBar value={data?.profile_completion ?? 0} label="Profile completion" />
        <div className="check-list"><div className={profile?.resume_path ? "" : "pending"}><CheckCircle2 size={16} /> Resume uploaded</div><div className={profile?.skills?.length ? "" : "pending"}><CheckCircle2 size={16} /> Skills added</div><div className="pending"><Clock3 size={16} /> Complete your profile</div></div>
      </section>
    </div>

    <section className="card">
      <div className="card-head"><div><h3>Recent interviews</h3><p>Your latest performance</p></div><Link to="/candidate/results" className="text-link">View results</Link></div>
      <div className="table-wrap"><table><thead><tr><th>Interview</th><th>Date</th><th>Type</th><th>Score</th><th>Status</th></tr></thead><tbody>
        {interviews.map(i => <tr key={i.id}><td><b>{i.title}</b><small>{i.jobs?.title || "Interview"}</small></td><td>{new Date(i.scheduled_at).toLocaleDateString()}</td><td>{i.type}</td><td><strong>—</strong></td><td><Badge tone={i.status === "completed" ? "success" : "info"}>{i.status}</Badge></td></tr>)}
      </tbody></table></div>
    </section>
  </div>;
}