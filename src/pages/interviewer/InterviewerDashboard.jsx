import { AlertTriangle, BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, Users, ArrowRight, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import StatCard from "../../components/StatCard";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function InterviewerDashboard() {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  useEffect(() => { Promise.all([api.get("/profiles/candidates"), api.get("/interviews"), api.get("/jobs")]).then(([candidateResult, interviewResult, jobResult]) => { setCandidates(candidateResult.data || []); setInterviews(interviewResult.data || []); setJobs(jobResult.data || []); }).catch(() => {}); }, []);
  const upcoming = interviews.filter(item => item.status === "scheduled" || item.status === "live");
  return <div>
    <SectionTitle eyebrow="COMPANY SPACE" title="Interviewer Dashboard" description="Monitor your hiring pipeline and active interviews." action={<Link className="btn btn-primary" to="/interviewer/jobs">Create position <BriefcaseBusiness size={16}/></Link>} />
    <div className="stats-grid">
      <StatCard icon={Users} value={candidates.length} label="Total candidates" />
      <StatCard icon={CalendarDays} value={upcoming.length} label="Upcoming interviews" />
      <StatCard icon={BarChart3} value="—" label="Average performance" tone="success" />
      <StatCard icon={AlertTriangle} value="—" label="Open integrity alerts" tone="warning" />
    </div>
    <div className="dashboard-grid">
      <section className="card">
        <div className="card-head"><div><h3>Live interviews</h3><p>Sessions requiring attention</p></div><Link className="text-link" to="/interviewer/live">Open monitor</Link></div>
        {upcoming.slice(0, 2).map(interview => <div className="live-candidate-row" key={interview.id}><span className="avatar">{(interview.profiles?.full_name || "C").slice(0, 2).toUpperCase()}</span><div><b>{interview.profiles?.full_name || "Candidate"}</b><p>{interview.title} · {interview.type}</p></div><Badge tone={interview.status === "live" ? "danger" : "neutral"}>{interview.status}</Badge><Link className="btn btn-outline" to={`/interviewer/live?interview=${interview.id}`}>Open</Link></div>)}{!upcoming.length && <p className="empty-state">No upcoming interviews.</p>}
      </section>
      <section className="card"><div className="card-head"><div><h3>Hiring funnel</h3><p>Current role pipeline</p></div></div><div className="funnel">{[["Applied","126"],["Screened","64"],["Interviewed","24"],["Shortlisted","8"],["Offer","3"]].map(([x,v],i)=><div key={x}><span>{x}</span><b>{v}</b><div className="funnel-bar" style={{width:`${100-i*17}%`}} /></div>)}</div></section>
    </div>
    <section className="card"><div className="card-head"><div><h3>Registered candidates</h3><p>Profiles from the shared candidate database</p></div><Link className="text-link" to="/interviewer/candidates">View all</Link></div><div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Headline</th><th>Location</th><th /></tr></thead><tbody>{candidates.slice(0, 6).map(candidate=><tr key={candidate.id}><td><div className="person-cell"><span className="avatar">{(candidate.full_name || "C").slice(0, 2).toUpperCase()}</span><b>{candidate.full_name || "Candidate"}</b></div></td><td>{candidate.headline || "Candidate"}</td><td>{candidate.location || "Not provided"}</td><td><Link className="icon-btn" to="/interviewer/candidates"><ArrowRight size={16}/></Link></td></tr>)}</tbody></table></div>{!candidates.length && <p className="empty-state">No registered candidates yet.</p>}</section>
  </div>;
}