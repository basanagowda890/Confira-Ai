import { AlertTriangle, BarChart3, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, Users, ArrowRight, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import SectionTitle from "../../components/SectionTitle";
import StatCard from "../../components/StatCard";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { subscribeToTable } from "../../lib/realtime";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
];

function getPhoto(c, idx = 0) {
  return c?.avatar_url || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
}

export default function InterviewerDashboard() {
  const { profile } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [jobs, setJobs] = useState([]);

  const loadData = useCallback(() => {
    Promise.all([
      api.get("/interviewer/dashboard"),
      api.get("/profiles/candidates"),
      api.get("/interviews"),
      api.get("/jobs"),
    ])
      .then(([dashRes, candidateRes, interviewRes, jobRes]) => {
        setDashboard(dashRes.data);
        setCandidates(candidateRes.data || []);
        setInterviews(interviewRes.data || []);
        setJobs(jobRes.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    const unsubJobs = subscribeToTable("jobs", null, loadData);
    const unsubApps = subscribeToTable("job_applications", null, loadData);
    const unsubInterviews = subscribeToTable("interviews", null, loadData);
    const unsubResults = subscribeToTable("interview_results", null, loadData);
    const unsubEvents = subscribeToTable("monitoring_events", null, loadData);
    const unsubScores = subscribeToTable("candidate_scores", null, loadData);
    return () => {
      unsubJobs();
      unsubApps();
      unsubInterviews();
      unsubResults();
      unsubEvents();
      unsubScores();
    };
  }, [loadData]);

  const upcoming = interviews.filter(item => item.status === "scheduled" || item.status === "live");
  const funnel = dashboard?.funnel || [
    { stage: "Applied", count: 0 },
    { stage: "Screening", count: 0 },
    { stage: "Interview", count: 0 },
    { stage: "Shortlisted", count: 0 },
    { stage: "Selected", count: 0 },
  ];
  const maxFunnelCount = Math.max(...funnel.map(f => f.count), 1);

  return (
    <div>
      <SectionTitle
        eyebrow="COMPANY SPACE"
        title="Interviewer Dashboard"
        description="Monitor your hiring pipeline, active interviews, and candidate performance."
        action={
          <Link className="btn btn-primary" to="/interviewer/jobs">
            Create position <BriefcaseBusiness size={16} />
          </Link>
        }
      />
      <div className="stats-grid">
        <StatCard
          icon={Users}
          value={dashboard?.total_candidates ?? candidates.length}
          label="Total candidates"
        />
        <StatCard
          icon={CalendarDays}
          value={dashboard?.upcoming_interviews ?? upcoming.length}
          label="Upcoming interviews"
        />
        <StatCard
          icon={BarChart3}
          value={dashboard?.average_score != null ? `${dashboard.average_score}%` : "—"}
          label="Average score"
          hint={dashboard?.average_score != null ? "Average candidate evaluation" : "Awaiting evaluations"}
          tone="success"
        />
        <StatCard
          icon={AlertTriangle}
          value={dashboard?.open_alerts ?? 0}
          label="Integrity alerts"
          tone={dashboard?.open_alerts > 0 ? "warning" : "neutral"}
          hint={dashboard?.open_alerts > 0 ? `${dashboard.open_alerts} integrity alert${dashboard.open_alerts > 1 ? "s" : ""} flagged` : "No open alerts"}
        />
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Live & upcoming interviews</h3>
              <p>Sessions requiring attention</p>
            </div>
            <Link className="text-link" to="/interviewer/interviews">Manage all</Link>
          </div>
          {upcoming.slice(0, 3).map((interview, idx) => (
            <div className="live-candidate-row" key={interview.id}>
              <span className="avatar" style={{ overflow: "hidden" }}>
                <img src={getPhoto(interview.profiles, idx)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </span>
              <div>
                <b>{interview.profiles?.full_name || "Candidate"}</b>
                <p>{interview.title} · {interview.type}</p>
              </div>
              <Badge tone={interview.status === "live" ? "danger" : "info"}>
                {interview.status}
              </Badge>
              <Link className="btn btn-outline" to={`/interviewer/live?interview=${interview.id}`}>
                Open
              </Link>
            </div>
          ))}
          {!upcoming.length && <p className="empty-state">No upcoming interviews scheduled.</p>}
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Hiring pipeline</h3>
              <p>Active applicants across your positions</p>
            </div>
            <Badge tone="info">{dashboard?.total_applications ?? 0} total</Badge>
          </div>
          <div className="funnel">
            {funnel.map(f => {
              const widthPct = Math.max(10, Math.round((f.count / maxFunnelCount) * 100));
              return (
                <div key={f.stage}>
                  <span>{f.stage}</span>
                  <b>{f.count}</b>
                  <div className="funnel-bar" style={{ width: `${widthPct}%` }} />
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h3>Registered candidates</h3>
            <p>Profiles available in your candidate database</p>
          </div>
          <Link className="text-link" to="/interviewer/candidates">View all</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Headline</th>
                <th>Location</th>
                <th>Resume</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {candidates.slice(0, 6).map((candidate, idx) => (
                <tr key={candidate.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar" style={{ overflow: "hidden" }}>
                        <img src={getPhoto(candidate, idx)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </span>
                      <b>{candidate.full_name || "Candidate"}</b>
                    </div>
                  </td>
                  <td>{candidate.headline || "Candidate"}</td>
                  <td>{candidate.location || "Not provided"}</td>
                  <td>
                    <Badge tone={candidate.resume_path ? "success" : "neutral"}>
                      {candidate.resume_path ? "Uploaded" : "None"}
                    </Badge>
                  </td>
                  <td>
                    <Link className="icon-btn" to="/interviewer/candidates" title="View candidate profile">
                      <ArrowRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!candidates.length && <p className="empty-state">No registered candidates yet.</p>}
      </section>
    </div>
  );
}