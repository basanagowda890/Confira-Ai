import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  Sparkles,
  BriefcaseBusiness,
  Radio,
  AlertCircle,
  TrendingUp,
  ClipboardCheck
} from "lucide-react";
import { useEffect, useState, useCallback, Component } from "react";
import { Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import StatCard from "../../components/StatCard";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

// Error Boundary for bulletproof rendering
class DashboardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("CandidateDashboard ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: "30px", textAlign: "center", margin: "20px auto", maxWidth: "600px" }}>
          <AlertCircle size={36} color="#ef4444" style={{ margin: "0 auto 10px" }} />
          <h3>Something went wrong rendering your dashboard</h3>
          <p className="muted" style={{ fontSize: "13px" }}>{this.state.error?.message || "Please reload to refresh your data."}</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: "12px" }}
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            Reload Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function safeDateParts(dateStr) {
  const fallback = { day: "—", month: "TBD", time: "Online" };
  if (!dateStr) return fallback;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return fallback;
    return {
      day: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    };
  } catch {
    return fallback;
  }
}

function safeFormatDate(dateStr) {
  if (!dateStr) return "TBD";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "TBD";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "TBD";
  }
}

function cleanText(str) {
  if (!str) return "";
  return String(str).replace(/\uFFFD/g, "·");
}

function getJob(item) {
  if (!item) return {};
  if (Array.isArray(item.jobs)) return item.jobs[0] || {};
  return item.jobs || {};
}

function getInterview(item) {
  if (!item) return {};
  if (Array.isArray(item.interviews)) return item.interviews[0] || {};
  return item.interviews || {};
}

function CandidateDashboardContent() {
  const { profile } = useAuth();
  const name = profile?.full_name || "Candidate";
  const [data, setData] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [groupDiscussions, setGroupDiscussions] = useState([]);

  const loadData = useCallback(() => {
    Promise.allSettled([
      api.get("/candidate/dashboard"),
      api.get("/interviews"),
      api.get("/group-discussions"),
    ])
      .then(([dashRes, intRes, gdRes]) => {
        if (dashRes.status === "fulfilled") {
          setData(dashRes.value?.data || dashRes.value || {});
        }
        if (intRes.status === "fulfilled") {
          const list = intRes.value?.data || intRes.value || [];
          setInterviews(Array.isArray(list) ? list.filter(Boolean) : []);
        }
        if (gdRes.status === "fulfilled") {
          const list = gdRes.value?.data || gdRes.value || [];
          setGroupDiscussions(Array.isArray(list) ? list.filter(Boolean) : []);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();

    const unsubInterviews = subscribeToTable("interviews", null, loadData);
    const unsubResults = subscribeToTable("interview_results", null, loadData);
    const unsubApplications = subscribeToTable("job_applications", null, loadData);
    const unsubDiscussions = subscribeToTable("group_discussions", null, loadData);
    const unsubNotifications = subscribeToTable("notifications", null, loadData);

    return () => {
      if (typeof unsubInterviews === "function") unsubInterviews();
      if (typeof unsubResults === "function") unsubResults();
      if (typeof unsubApplications === "function") unsubApplications();
      if (typeof unsubDiscussions === "function") unsubDiscussions();
      if (typeof unsubNotifications === "function") unsubNotifications();
    };
  }, [loadData]);

  // Derived real database records
  const upcomingInts = interviews.filter(i => i && (i.status === "scheduled" || i.status === "live"));
  const completedInts = interviews.filter(i => i && i.status === "completed");
  
  const upcoming = upcomingInts[0] || (Array.isArray(data?.upcoming_interviews) ? data.upcoming_interviews[0] : null) || null;
  const upcomingParts = safeDateParts(upcoming?.scheduled_at);
  const upcomingJob = getJob(upcoming);
  const upcomingGD = groupDiscussions.find(d => d && (d.status === "live" || d.status === "scheduled"));
  
  // Real stats (guaranteed numbers/strings)
  const scheduledCount = typeof data?.scheduled_interviews === "number"
    ? data.scheduled_interviews
    : (Array.isArray(data?.scheduled_interviews) ? data.scheduled_interviews.length : upcomingInts.length);

  const completedCount = typeof data?.completed_interviews === "number"
    ? data.completed_interviews
    : (Array.isArray(data?.completed_interviews) ? data.completed_interviews.length : completedInts.length);

  const totalAppsCount = typeof data?.total_applications === "number"
    ? data.total_applications
    : (typeof data?.applications_count === "number" ? data.applications_count : (Array.isArray(data?.recent_applications) ? data.recent_applications.length : 0));

  const avgScore = data?.average_score != null ? `${data.average_score}%` : "—";
  
  const recentApps = (data?.recent_applications || []).filter(Boolean);
  const recentResults = (data?.recent_results || []).filter(Boolean);

  // Profile fields & completion
  const skillsArray = Array.isArray(profile?.skills)
    ? profile.skills
    : typeof profile?.skills === "string"
      ? profile.skills.split(",").map(s => s.trim()).filter(Boolean)
      : [];
  const profileCompletion = typeof data?.profile_completion === "number" ? data.profile_completion : 0;

  return (
    <div className="candidate-dashboard">
      {/* Top Header & Quick Actions */}
      <SectionTitle
        eyebrow="CANDIDATE DASHBOARD"
        title={`Welcome, ${name}`}
        description="Track your scheduled interviews, screening results, and hiring pipeline in real time."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Link className="btn btn-outline" to="/candidate/jobs">
              <BriefcaseBusiness size={15} /> Find Jobs
            </Link>
            <Link className="btn btn-outline" to="/candidate/practice">
              <ClipboardCheck size={15} /> Practice Tests
            </Link>
            <Link className="btn btn-primary" to="/candidate/interviews">
              <CalendarDays size={15} /> My Interviews
            </Link>
          </div>
        }
      />

      {/* Live / Scheduled Group Discussion Banner if present */}
      {upcomingGD && (
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg, #00537A, #013C58)",
            color: "#FFFFFF",
            padding: "18px 22px",
            borderRadius: "18px",
            marginBottom: "20px",
            border: "1px solid rgba(168, 232, 249, 0.3)",
            boxShadow: "0 10px 30px rgba(0, 83, 122, 0.2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "14px"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="live-pill" style={{ background: upcomingGD.status === "live" ? "#D9381E" : "rgba(168, 232, 249, 0.25)", color: "#FFFFFF", border: "1px solid rgba(255,255,255,0.2)" }}>
                <span className="live-dot" style={{ background: upcomingGD.status === "live" ? "#FFFFFF" : "#FFD35B" }} /> {upcomingGD.status ? String(upcomingGD.status).toUpperCase() : "LIVE"} GROUP DISCUSSION
              </span>
              <b style={{ color: "#FFFFFF", fontSize: "16px" }}>{cleanText(upcomingGD.title)}</b>
            </div>
            <p style={{ margin: 0, color: "#A8E8F9", fontSize: "13px" }}>
              Topic: "{upcomingGD.topic || "Architecture & Problem Solving"}" · Duration: {upcomingGD.duration_minutes || 30} mins
            </p>
          </div>

          <Link
            className="btn btn-accent"
            to={`/candidate/group-discussion?discussion=${upcomingGD.id}`}
            style={{
              padding: "9px 18px"
            }}
          >
            <Radio size={15} /> Join Group Discussion <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="stats-grid">
        <StatCard
          icon={BriefcaseBusiness}
          value={totalAppsCount}
          label="Job applications"
          hint={typeof data?.shortlisted_count === "number" && data.shortlisted_count > 0 ? `${data.shortlisted_count} shortlisted` : "Active roles applied"}
        />
        <StatCard
          icon={CalendarDays}
          value={scheduledCount}
          label="Scheduled interviews"
          hint="Upcoming live assessments"
        />
        <StatCard
          icon={FileText}
          value={completedCount}
          label="Completed interviews"
          hint="Finished evaluations"
        />
        <StatCard
          icon={Sparkles}
          value={avgScore}
          label="Average score"
          hint={avgScore !== "—" ? "Based on evaluated rounds" : "Awaiting evaluations"}
          tone={avgScore !== "—" ? "success" : "default"}
        />
      </div>

      {/* Application Status Pipeline Bar */}
      {totalAppsCount > 0 && (
        <div className="card" style={{ padding: "14px 20px", marginBottom: "18px", borderRadius: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--ink)", display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp size={15} color="var(--maroon)" /> Application Pipeline Breakdown
            </span>
            <span style={{ fontSize: "11px", color: "var(--muted)" }}>
              {totalAppsCount} total application{totalAppsCount > 1 ? "s" : ""}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ padding: "4px 10px", borderRadius: "8px", background: "#F3F4F6", fontSize: "11px", fontWeight: "700" }}>
              Applied: {Number(data?.applied_count) || 0}
            </span>
            <span style={{ padding: "4px 10px", borderRadius: "8px", background: "#EFF6FF", color: "#1d4ed8", fontSize: "11px", fontWeight: "700" }}>
              Screening: {Number(data?.screening_count) || 0}
            </span>
            <span style={{ padding: "4px 10px", borderRadius: "8px", background: "#FEF3C7", color: "#b45309", fontSize: "11px", fontWeight: "700" }}>
              Shortlisted: {Number(data?.shortlisted_count) || 0}
            </span>
            <span style={{ padding: "4px 10px", borderRadius: "8px", background: "#F3E8FF", color: "#6b21a8", fontSize: "11px", fontWeight: "700" }}>
              Interviewing: {Number(data?.interviewing_count) || 0}
            </span>
            <span style={{ padding: "4px 10px", borderRadius: "8px", background: "#DCFCE7", color: "#15803d", fontSize: "11px", fontWeight: "700" }}>
              Selected: {Number(data?.selected_count) || 0}
            </span>
            {Boolean(data?.rejected_count) && (
              <span style={{ padding: "4px 10px", borderRadius: "8px", background: "#FEE2E2", color: "#b91c1c", fontSize: "11px", fontWeight: "700" }}>
                Archived: {Number(data.rejected_count)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Grid: Next Interview Hero + Profile Readiness */}
      <div className="dashboard-grid">
        
        {/* Next Scheduled Interview Hero */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Next scheduled interview</h3>
              <p>Your upcoming assessment</p>
            </div>
            {upcoming && (
              <Badge tone={upcoming.status === "live" ? "danger" : "info"}>
                {String(upcoming.status || "scheduled")}
              </Badge>
            )}
          </div>

          {upcoming ? (
            <div className="interview-hero">
              <div className="date-tile">
                <b>{upcomingParts.day}</b>
                <span>{upcomingParts.month}</span>
              </div>
              <div>
                <h3>{cleanText(upcoming.title)}</h3>
                <p>{upcomingJob?.title || upcoming.type || "Interview"} · {upcoming.duration_minutes || 60} minutes</p>
                <span className="muted" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                  <Clock3 size={13} /> {upcomingParts.time} · Online Assessment Room
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  className="btn btn-primary"
                  to={`/candidate/live?interview=${upcoming.id}`}
                  style={{
                    background: upcoming.status === "live" ? "#ef4444" : "var(--maroon)",
                    borderColor: upcoming.status === "live" ? "#ef4444" : "var(--maroon)"
                  }}
                >
                  <Radio size={15} /> Join Interview <ArrowRight size={15} />
                </Link>
                <Link
                  className="btn btn-outline"
                  to={`/candidate/instructions?interview=${upcoming.id}`}
                >
                  <Sparkles size={15} /> Instructions
                </Link>
              </div>
            </div>
          ) : (
            <div style={{ padding: "20px 0", textAlign: "center" }}>
              <CalendarDays size={36} color="var(--muted)" style={{ margin: "0 auto 8px" }} />
              <p className="empty-state" style={{ marginBottom: "12px" }}>No upcoming interviews scheduled yet.</p>
              <Link to="/candidate/jobs" className="btn btn-outline btn-sm">
                Apply for Open Positions
              </Link>
            </div>
          )}
        </section>

        {/* Profile Readiness & Resume Checklist */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Profile readiness</h3>
              <p>Keep your details complete for employers</p>
            </div>
            <b>{profileCompletion}%</b>
          </div>
          <ProgressBar value={profileCompletion} label="Profile completion" />
          
          <div className="check-list" style={{ marginTop: "14px" }}>
            <div className={profile?.resume_path ? "" : "pending"}>
              <CheckCircle2 size={16} />
              <span>
                {profile?.resume_path ? "Resume uploaded" : "Upload your resume"}
              </span>
            </div>
            <div className={skillsArray.length > 0 ? "" : "pending"}>
              <CheckCircle2 size={16} />
              <span>Skills added ({skillsArray.length})</span>
            </div>
            <div className={profile?.headline ? "" : "pending"}>
              <CheckCircle2 size={16} />
              <span>{profile?.headline || "Add professional headline"}</span>
            </div>
            <div className={profile?.location ? "" : "pending"}>
              <CheckCircle2 size={16} />
              <span>{profile?.location || "Add your location"}</span>
            </div>
          </div>

          <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
            <Link to="/candidate/profile" className="btn btn-outline btn-sm">
              Manage Profile & Resume →
            </Link>
          </div>
        </section>
      </div>

      {/* Recent Interviews Table */}
      <section className="card" style={{ marginTop: "18px" }}>
        <div className="card-head">
          <div>
            <h3>My interview sessions</h3>
            <p>Your scheduled and completed interview history</p>
          </div>
          <Link to="/candidate/interviews" className="text-link">View all</Link>
        </div>

        {interviews.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Interview</th>
                  <th>Date</th>
                  <th>Round Type</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {interviews.map(i => {
                  const intJob = getJob(i);
                  return (
                    <tr key={i.id}>
                      <td>
                        <b>{cleanText(i.title)}</b>
                        <small style={{ display: "block", color: "var(--muted)" }}>
                          {intJob?.title || "Role Evaluation"}
                        </small>
                      </td>
                      <td>{safeFormatDate(i.scheduled_at)}</td>
                      <td style={{ textTransform: "capitalize" }}>{i.type || "Technical"}</td>
                      <td>{i.duration_minutes || 60} min</td>
                      <td>
                        <Badge tone={i.status === "completed" ? "success" : i.status === "live" ? "danger" : "info"}>
                          {String(i.status || "scheduled")}
                        </Badge>
                      </td>
                      <td>
                        {(i.status === "live" || i.status === "scheduled") ? (
                          <Link
                            className="btn btn-primary btn-sm"
                            to={`/candidate/live?interview=${i.id}`}
                            style={{
                              background: i.status === "live" ? "#ef4444" : "var(--maroon)",
                              borderColor: i.status === "live" ? "#ef4444" : "var(--maroon)"
                            }}
                          >
                            <Radio size={13} /> Join
                          </Link>
                        ) : (
                          <Link
                            className="btn btn-outline btn-sm"
                            to={`/candidate/results?interview=${i.id}`}
                          >
                            Results
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No interviews recorded yet.</p>
        )}
      </section>

      {/* Active Job Applications Table */}
      <section className="card" style={{ marginTop: "18px" }}>
        <div className="card-head">
          <div>
            <h3>My job applications</h3>
            <p>Status of positions you have applied for</p>
          </div>
          <Link to="/candidate/jobs" className="text-link">Explore more jobs</Link>
        </div>

        {recentApps.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Department</th>
                  <th>Location</th>
                  <th>Applied Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentApps.map(a => {
                  const appJob = getJob(a);
                  return (
                    <tr key={a.id}>
                      <td>
                        <b>{appJob?.title || "Role Application"}</b>
                        <small style={{ display: "block", color: "var(--muted)", textTransform: "capitalize" }}>
                          {appJob?.employment_type ? appJob.employment_type.replace("_", " ") : "Full-time"}
                        </small>
                      </td>
                      <td>{appJob?.department || "General"}</td>
                      <td>{appJob?.location || "Remote"}</td>
                      <td>{safeFormatDate(a.created_at)}</td>
                      <td>
                        <Badge tone={a.status === "shortlisted" || a.status === "selected" ? "success" : a.status === "interview" ? "info" : a.status === "rejected" ? "danger" : "neutral"}>
                          {String(a.status || "applied")}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "16px" }}>
            <p className="empty-state" style={{ marginBottom: "12px" }}>You have not applied for any jobs yet.</p>
            <Link to="/candidate/jobs" className="btn btn-outline btn-sm">Browse Open Positions</Link>
          </div>
        )}
      </section>

      {/* Recent Evaluation Results (if available) */}
      {recentResults.length > 0 && (
        <section className="card" style={{ marginTop: "18px" }}>
          <div className="card-head">
            <div>
              <h3>Recent assessment results</h3>
              <p>Evaluations and feedback from completed interview rounds</p>
            </div>
            <Link to="/candidate/results" className="text-link">View all results</Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
            {recentResults.map(r => {
              const resInt = getInterview(r);
              const resJob = getJob(resInt);
              const targetInterviewId = r.interview_id || resInt?.id;
              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: "12px",
                    padding: "16px",
                    background: "#FAF6F3"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <b style={{ fontSize: "14px" }}>{cleanText(resInt?.title) || "Interview Assessment"}</b>
                    <Badge tone={(r.overall_score || 0) >= 70 ? "success" : (r.overall_score || 0) >= 50 ? "info" : "neutral"}>
                      {r.overall_score != null ? `${r.overall_score}%` : (r.recommendation ? String(r.recommendation).replace("_", " ").toUpperCase() : "Evaluated")}
                    </Badge>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "12px", color: "var(--muted)" }}>
                    {resJob?.title || "Position Evaluation"} · {safeFormatDate(r.created_at)}
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px", marginBottom: "12px" }}>
                    <div style={{ background: "#fff", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--muted)", display: "block" }}>Technical</span>
                      <b>{r.technical_score != null ? `${r.technical_score}%` : "—"}</b>
                    </div>
                    <div style={{ background: "#fff", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)" }}>
                      <span style={{ color: "var(--muted)", display: "block" }}>Communication</span>
                      <b>{r.communication_score != null ? `${r.communication_score}%` : "—"}</b>
                    </div>
                  </div>

                  {targetInterviewId && (
                    <Link to={`/candidate/results?interview=${targetInterviewId}`} className="btn btn-outline btn-sm" style={{ width: "100%", justifyContent: "center" }}>
                      View Full Report <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export default function CandidateDashboard() {
  return (
    <DashboardErrorBoundary>
      <CandidateDashboardContent />
    </DashboardErrorBoundary>
  );
}