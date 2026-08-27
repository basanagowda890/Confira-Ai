import { useEffect, useState, useCallback } from "react";
import { Download, Search, SlidersHorizontal, UserRound, ArrowRight, CalendarDays, FileText, Eye, Mail, Phone, MapPin, Briefcase, Send } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
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

export default function Candidates() {
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [viewingResume, setViewingResume] = useState(false);

  // Send Notification modal state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCandidate, setNotifCandidate] = useState(null);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  const [form, setForm] = useState({
    job_id: "",
    date: "",
    time: "",
    type: "technical",
    duration_minutes: 60,
    instructions: "",
  });

  const loadData = useCallback(() => {
    Promise.all([
      api.get("/profiles/candidates"),
      api.get("/jobs"),
    ])
      .then(([candidateResult, jobResult]) => {
        setCandidates(candidateResult.data || []);
        setJobs((jobResult.data || []).filter(job => job.status !== "closed"));
      })
      .catch(error => setToast(error.message));
  }, []);

  useEffect(() => {
    loadData();
    const unsubProfiles = subscribeToTable("profiles", null, loadData);
    const unsubJobs = subscribeToTable("jobs", null, loadData);
    return () => {
      unsubProfiles();
      unsubJobs();
    };
  }, [loadData]);

  const filtered = candidates.filter(c =>
    `${c.full_name || ""} ${c.headline || ""} ${c.location || ""} ${(c.skills || []).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  function openSchedule(candidate) {
    setSelected(candidate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    setForm({
      job_id: jobs[0]?.id || "",
      date: dateStr,
      time: "10:00",
      type: "technical",
      duration_minutes: 60,
      instructions: "Please be ready with a quiet environment and working camera.",
    });
    setScheduleOpen(true);
  }

  function openNotificationModal(candidate) {
    setNotifCandidate(candidate);
    setNotifTitle("");
    setNotifMessage("");
    setNotifOpen(true);
  }

  async function handleSendNotification(e) {
    e.preventDefault();
    if (!notifCandidate || !notifTitle.trim() || !notifMessage.trim()) {
      setToast("Please fill in notification title and message.");
      return;
    }
    setSendingNotif(true);
    try {
      await api.post("/notifications/send", {
        candidate_id: notifCandidate.id,
        title: notifTitle.trim(),
        message: notifMessage.trim(),
      });
      setNotifOpen(false);
      setToast(`Notification sent to ${notifCandidate.full_name || "candidate"} successfully!`);
    } catch (error) {
      setToast(error.message || "Failed to send notification.");
    } finally {
      setSendingNotif(false);
      setTimeout(() => setToast(""), 3000);
    }
  }

  async function viewResume(candidateId) {
    setViewingResume(true);
    try {
      const res = await api.get(`/uploads/resume/${candidateId}`);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setToast(error.message || "Unable to load resume. Candidate may not have uploaded one yet.");
      setTimeout(() => setToast(""), 3000);
    } finally {
      setViewingResume(false);
    }
  }

  async function schedule(e) {
    e.preventDefault();
    if (!form.job_id || !form.date || !form.time || !selected) {
      setToast("Please fill in all required scheduling fields.");
      return;
    }
    setScheduling(true);
    try {
      const selectedJob = jobs.find(j => j.id === form.job_id);
      const jobTitle = selectedJob ? selectedJob.title : "Interview";
      const formattedTime = form.time.length === 5 ? `${form.time}:00` : form.time;
      const dateObj = new Date(`${form.date}T${formattedTime}`);
      const scheduledIso = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

      await api.post("/interviews", {
        job_id: form.job_id,
        candidate_id: selected.id,
        title: `${jobTitle} — ${selected.full_name || "Candidate"}`,
        type: form.type,
        scheduled_at: scheduledIso,
        duration_minutes: form.duration_minutes,
        instructions: form.instructions,
      });

      setScheduleOpen(false);
      setSelected(null);
      setToast("Interview scheduled and candidate notified successfully!");
    } catch (error) {
      setToast(error.message || "Failed to schedule interview.");
    } finally {
      setScheduling(false);
      setTimeout(() => setToast(""), 3000);
    }
  }

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="CANDIDATES"
        title="Candidate management"
        description="Review candidate profiles, inspect verified resumes, and schedule interviews."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <Link className="btn btn-primary" to="/interviewer/comparison">
              Compare candidates
            </Link>
          </div>
        }
      />

      <div className="search-row">
        <div className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search candidates by name, headline, location, or skill..."
          />
        </div>
        <button
          className={`filter ${filtersOpen ? "active" : ""}`}
          onClick={() => setFiltersOpen(value => !value)}
        >
          <SlidersHorizontal size={15} /> Filters
        </button>
      </div>

      {filtersOpen && (
        <p className="form-notice" role="status">
          Showing {filtered.length} of {candidates.length} candidates.
        </p>
      )}

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Headline</th>
                <th>Location</th>
                <th>Skills</th>
                <th>Resume</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((candidate, idx) => (
                <tr key={candidate.id}>
                  <td>
                    <div className="person-cell">
                      <span className="avatar" style={{ overflow: "hidden" }}>
                        <img src={getPhoto(candidate, idx)} alt={candidate.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </span>
                      <div>
                        <b>{candidate.full_name || "Unnamed candidate"}</b>
                        <small>{candidate.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>{candidate.headline || "Candidate"}</td>
                  <td>{candidate.location || "Not provided"}</td>
                  <td>
                    <div className="skill-row">
                      {(candidate.skills || []).slice(0, 3).map(skill => (
                        <span key={skill}>{skill}</span>
                      ))}
                      {(candidate.skills || []).length > 3 && (
                        <span>+{(candidate.skills || []).length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {candidate.resume_path ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                        onClick={() => viewResume(candidate.id)}
                        disabled={viewingResume}
                      >
                        <Eye size={13} /> View
                      </button>
                    ) : (
                      <span className="muted" style={{ fontSize: "12px" }}>None</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-outline" onClick={() => setSelected(candidate)}>
                        Profile <ArrowRight size={14} />
                      </button>
                      <button
                        className="btn btn-outline"
                        onClick={() => openNotificationModal(candidate)}
                        title="Send notification to candidate"
                      >
                        <Send size={13} /> Notify
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => openSchedule(candidate)}
                        disabled={!jobs.length}
                        title={jobs.length ? "Schedule an interview" : "Create a position first"}
                      >
                        <CalendarDays size={14} /> Schedule
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && <p className="empty-state">No registered candidates found.</p>}
      </section>

      {/* Candidate Profile Modal */}
      <Modal open={Boolean(selected) && !scheduleOpen && !notifOpen} title={selected?.full_name || "Candidate profile"} onClose={() => setSelected(null)}>
        {selected && (
          <div className="candidate-profile-modal">
            <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "16px" }}>
              <div className="candidate-profile-avatar" style={{ margin: 0, overflow: "hidden" }}>
                <img src={getPhoto(selected)} alt={`${selected.full_name} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div>
                <h3 style={{ margin: 0 }}>{selected.full_name}</h3>
                <p style={{ margin: "2px 0", color: "#a1a1aa" }}>{selected.headline || "Candidate"}</p>
                <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#a1a1aa", marginTop: "4px" }}>
                  <span><Mail size={13} style={{ verticalAlign: "middle" }} /> {selected.email}</span>
                  {selected.location && <span><MapPin size={13} style={{ verticalAlign: "middle" }} /> {selected.location}</span>}
                  {selected.phone && <span><Phone size={13} style={{ verticalAlign: "middle" }} /> {selected.phone}</span>}
                </div>
              </div>
            </div>

            <div style={{ margin: "16px 0" }}>
              <h4 style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#a1a1aa", marginBottom: "6px" }}>About</h4>
              <p>{selected.bio || "This candidate has not added a bio yet."}</p>
            </div>

            <div style={{ margin: "16px 0" }}>
              <h4 style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#a1a1aa", marginBottom: "6px" }}>Skills</h4>
              <div className="skill-row">
                {(selected.skills || []).map(skill => (
                  <span key={skill}>{skill}</span>
                ))}
                {!selected.skills?.length && <small className="muted">No skills listed.</small>}
              </div>
            </div>

            <div style={{ margin: "16px 0", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <FileText size={18} />
                <span>Resume: {selected.resume_path ? "Uploaded & Available" : "Not uploaded"}</span>
              </div>
              {selected.resume_path && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => viewResume(selected.id)}
                  disabled={viewingResume}
                >
                  <Eye size={14} /> View Signed Resume
                </button>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button className="btn btn-outline" type="button" onClick={() => setSelected(null)}>
                Close
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => openNotificationModal(selected)}
              >
                <Send size={14} /> Send Notification
              </button>
              <button
                className="btn btn-primary"
                onClick={() => openSchedule(selected)}
                disabled={!jobs.length}
              >
                <CalendarDays size={15} /> Schedule interview
              </button>
            </div>
            {!jobs.length && (
              <small className="muted" style={{ display: "block", marginTop: "8px" }}>
                Create a job position before scheduling an interview.
              </small>
            )}
          </div>
        )}
      </Modal>

      {/* Send Notification Modal */}
      <Modal
        open={notifOpen}
        title={`Send Notification to ${notifCandidate?.full_name || "Candidate"}`}
        onClose={() => setNotifOpen(false)}
      >
        <form className="form-grid" onSubmit={handleSendNotification}>
          <label className="span-2">
            Notification Title
            <input
              value={notifTitle}
              onChange={e => setNotifTitle(e.target.value)}
              placeholder="e.g. Interview preparation details"
              required
            />
          </label>
          <label className="span-2">
            Message
            <textarea
              value={notifMessage}
              onChange={e => setNotifMessage(e.target.value)}
              placeholder="Write the message that will be immediately delivered to the candidate."
              rows={4}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={sendingNotif}>
            <Send size={15} /> {sendingNotif ? "Sending..." : "Send Notification"}
          </button>
        </form>
      </Modal>

      {/* Schedule Interview Modal */}
      <Modal
        open={scheduleOpen}
        title={`Schedule interview with ${selected?.full_name || "candidate"}`}
        onClose={() => setScheduleOpen(false)}
      >
        <form className="form-grid" onSubmit={schedule}>
          <label>
            Position
            <select
              value={form.job_id}
              onChange={e => setForm({ ...form, job_id: e.target.value })}
              required
            >
              {jobs.map(job => (
                <option value={job.id} key={job.id}>
                  {job.title} ({job.department || "Engineering"})
                </option>
              ))}
            </select>
          </label>
          <label>
            Interview Round
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              <option value="technical">Technical</option>
              <option value="hr">HR</option>
              <option value="technical_hr">Technical + HR</option>
              <option value="system_design">System Design</option>
              <option value="behavioral">Behavioral</option>
            </select>
          </label>
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              required
            />
          </label>
          <label>
            Time
            <input
              type="time"
              value={form.time}
              onChange={e => setForm({ ...form, time: e.target.value })}
              required
            />
          </label>
          <label>
            Duration
            <select
              value={form.duration_minutes}
              onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}
            >
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
            </select>
          </label>
          <label className="span-2">
            Preparation instructions for candidate
            <textarea
              value={form.instructions}
              onChange={e => setForm({ ...form, instructions: e.target.value })}
              rows={3}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={scheduling}>
            <CalendarDays size={15} /> {scheduling ? "Scheduling..." : "Confirm & Schedule Interview"}
          </button>
        </form>
      </Modal>
    </div>
  );
}