import { useEffect, useState, useCallback } from "react";
import {
  BriefcaseBusiness,
  MapPin,
  Send,
  CheckCircle2,
  Clock3,
  Building2,
  Search,
  Loader2,
  Sparkles,
  ArrowRight
} from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";
import { useAuth } from "../../context/AuthContext";

export default function CandidateJobs() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [applyingId, setApplyingId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [jobResult, applicationResult] = await Promise.all([
        api.get("/jobs"),
        api.get("/candidate/applications").catch(() => ({ data: [] }))
      ]);
      setJobs(jobResult.data || []);
      setApplications(applicationResult.data || []);
    } catch (error) {
      // Don't show technical permission errors if it's just public browsing
      if (!error.message?.includes("permission")) {
        setToast(error.message || "Failed to load jobs.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubJobs = subscribeToTable("jobs", null, load);
    const unsubApps = subscribeToTable("job_applications", null, load);
    return () => {
      unsubJobs();
      unsubApps();
    };
  }, [load]);

  const applicationFor = jobId => applications.find(a => a.job_id === jobId);

  async function apply(job) {
    setApplyingId(job.id);
    try {
      await api.post(`/jobs/${job.id}/apply`);
      setToast(`Application submitted successfully for ${job.title}!`);
      // Optimistic update
      setApplications(prev => [
        ...prev.filter(a => a.job_id !== job.id),
        {
          id: `temp-${Date.now()}`,
          job_id: job.id,
          status: "applied",
          created_at: new Date().toISOString(),
          jobs: job
        }
      ]);
      await load();
    } catch (error) {
      setToast(error.message || "Failed to submit application.");
    } finally {
      setApplyingId(null);
    }
  }

  async function withdraw(app) {
    if (!window.confirm(`Are you sure you want to withdraw your application for "${app.jobs?.title || "this position"}"?`)) {
      return;
    }
    try {
      await api.delete(`/candidate/applications/${app.id}`);
      setToast("Application withdrawn successfully.");
      setApplications(prev => prev.filter(a => a.id !== app.id));
      await load();
    } catch (error) {
      setToast(error.message || "Failed to withdraw application.");
    }
  }

  const filteredJobs = jobs.filter(j =>
    `${j.title} ${j.department || ""} ${j.location || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />

      <SectionTitle
        eyebrow="JOBS & OPPORTUNITIES"
        title="Find your next opportunity"
        description="Browse published positions, apply directly, and track your applications in real-time."
      />

      {/* Search Bar */}
      <div className="search-row" style={{ marginBottom: "20px" }}>
        <div className="search-box">
          <Search size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search positions by title, department or location..."
            aria-label="Search positions"
          />
        </div>
      </div>

      {/* Job Cards Grid */}
      <div className="cards-2" style={{ marginBottom: "28px" }}>
        {filteredJobs.map(job => {
          const application = applicationFor(job.id);
          const isApplying = applyingId === job.id;

          return (
            <section className="card job-card" key={job.id} style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "12px" }}>
                  <div className="job-icon" style={{ flex: "none" }}>
                    <BriefcaseBusiness size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{job.title}</h3>
                      <Badge tone="success">Open</Badge>
                    </div>
                    <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                      {job.department || "Engineering"}
                    </p>
                  </div>
                </div>

                <p style={{ fontSize: "13px", color: "var(--ink)", lineHeight: "1.5", margin: "10px 0" }}>
                  {job.description || "Join our team and participate in our technical interview evaluation process."}
                </p>

                <div className="meta-row" style={{ marginTop: "12px", gap: "16px" }}>
                  <span><MapPin size={14} /> {job.location || "Remote"}</span>
                  <span><Building2 size={14} /> {job.employment_type || "Full-time"}</span>
                  {job.experience_level && <span><Sparkles size={14} /> {job.experience_level}</span>}
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "14px", marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {application ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--success)" }}>
                      Application Submitted
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                    Ready to evaluate
                  </span>
                )}

                {application ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Badge tone={application.status === "interview" ? "success" : application.status === "shortlisted" ? "info" : "warning"}>
                      Status: {application.status}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => withdraw(application)}
                      className="btn btn-outline btn-sm"
                      style={{ padding: "3px 8px", fontSize: "11px", color: "#ef4444", borderColor: "#fca5a5" }}
                      title="Withdraw application"
                    >
                      Withdraw
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => apply(job)}
                    disabled={isApplying}
                    type="button"
                  >
                    {isApplying ? (
                      <><Loader2 size={15} className="spin" /> Applying...</>
                    ) : (
                      <><Send size={15} /> Apply Now</>
                    )}
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {!filteredJobs.length && !loading && (
        <div className="card" style={{ padding: "40px", textAlign: "center" }}>
          <p className="empty-state">No matching published jobs found.</p>
        </div>
      )}

      {/* Candidate's Applications Section */}
      <section className="card">
        <div className="card-head">
          <div>
            <h3>My applications</h3>
            <p>Track progress and status updates for your submitted applications.</p>
          </div>
          <Badge tone="info">{applications.length} submitted</Badge>
        </div>

        {applications.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Department</th>
                  <th>Applied On</th>
                  <th>Current Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id}>
                    <td>
                      <b>{app.jobs?.title || "Position"}</b>
                      <small>{app.jobs?.location || "Remote"}</small>
                    </td>
                    <td>{app.jobs?.department || "Engineering"}</td>
                    <td>{new Date(app.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</td>
                    <td>
                      <Badge tone={app.status === "interview" || app.status === "selected" ? "success" : app.status === "shortlisted" ? "info" : "warning"}>
                        {app.status}
                      </Badge>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => withdraw(app)}
                        className="btn btn-outline btn-sm"
                        style={{ padding: "4px 8px", fontSize: "11px", color: "#ef4444", borderColor: "#fca5a5" }}
                      >
                        Withdraw
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">You have not applied to any positions yet. Click "Apply Now" on an open position above.</p>
        )}
      </section>
    </div>
  );
}
