import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Plus, Clock3, Video, Users, MoreHorizontal, ChevronLeft, ChevronRight, Ban, PlayCircle, ThumbsUp, ThumbsDown, CheckCircle2, PhoneOff, X, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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
  const url = c?.avatar_url;
  if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:"))) {
    return url;
  }
  return DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
}

export default function InterviewManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  // Decision Modal state
  const [decisionModal, setDecisionModal] = useState({ open: false, row: null, type: "selected", feedback: "", strengths: "", weaknesses: "", score: 85, loading: false });

  const [form, setForm] = useState({
    candidate_id: "",
    job_id: "",
    title: "Technical Interview",
    type: "technical",
    scheduled_at: "",
    duration_minutes: 60,
    instructions: "",
  });

  const loadData = useCallback(() => {
    Promise.all([
      api.get("/interviews"),
      api.get("/jobs"),
      api.get("/profiles/candidates"),
    ])
      .then(([interviews, jobResult, candidateResult]) => {
        setRows(interviews.data || []);
        setJobs((jobResult.data || []).filter(j => j.status !== "closed"));
        setCandidates(candidateResult.data || []);
      })
      .catch(error => setToast(error.message));
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToTable("interviews", null, loadData);
    return () => unsub();
  }, [loadData]);

  // Handle auto-schedule trigger from notification link
  useEffect(() => {
    if (searchParams.get("schedule") === "true" && candidates.length > 0 && jobs.length > 0) {
      const candidateIdParam = searchParams.get("candidate");
      const jobIdParam = searchParams.get("job");

      const targetCandidate = candidates.find(c => c.id === candidateIdParam) || candidates[0];
      const targetJob = jobs.find(j => j.id === jobIdParam) || jobs[0];

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const pad = n => String(n).padStart(2, "0");
      const defaultDatetime = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;

      setForm({
        candidate_id: targetCandidate?.id || "",
        job_id: targetJob?.id || "",
        title: targetJob ? `${targetJob.title} — ${targetCandidate?.full_name || "Interview"}` : "Technical Interview",
        type: "technical",
        scheduled_at: defaultDatetime,
        duration_minutes: 60,
        instructions: "Please be ready with a quiet environment and working camera.",
      });
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, candidates, jobs, setSearchParams]);

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString("en-US", { month: "long" });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const interviewsByDay = rows.reduce((result, row) => {
    const date = new Date(row.scheduled_at);
    if (!Number.isNaN(date.getTime())) {
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      result[key] = (result[key] || 0) + 1;
    }
    return result;
  }, {});

  const selectedInterviewCount = interviewsByDay[`${year}-${month}-${selectedDay}`] || 0;

  function changeMonth(offset) {
    setCalendarDate(new Date(year, month + offset, 1));
    setSelectedDay(1);
  }

  function openSchedule() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    // Format YYYY-MM-DDTHH:mm for datetime-local
    const pad = n => String(n).padStart(2, "0");
    const defaultDatetime = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;

    const defaultJob = jobs[0];
    const defaultCandidate = candidates[0];

    setForm({
      candidate_id: defaultCandidate?.id || "",
      job_id: defaultJob?.id || "",
      title: defaultJob ? `${defaultJob.title} — ${defaultCandidate?.full_name || "Interview"}` : "Technical Interview",
      type: "technical",
      scheduled_at: defaultDatetime,
      duration_minutes: 60,
      instructions: "Please be ready with a quiet environment and working camera.",
    });
    setOpen(true);
  }

  async function schedule(event) {
    event.preventDefault();
    if (!form.candidate_id || !form.job_id || !form.scheduled_at) {
      setToast("Please fill in all required scheduling details.");
      return;
    }

    setSaving(true);
    try {
      const dateObj = new Date(form.scheduled_at);
      const scheduledIso = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();
      await api.post("/interviews", {
        ...form,
        scheduled_at: scheduledIso,
      });
      setOpen(false);
      setToast("Interview scheduled and candidate notified successfully!");
      await loadData();
    } catch (error) {
      setToast(error.message || "Failed to schedule interview.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 3000);
    }
  }

  async function cancelInterview(id) {
    if (!window.confirm("Are you sure you want to cancel this interview session?")) return;
    try {
      await api.delete(`/interviews/${id}`);
      setToast("Interview cancelled.");
      setMenu(null);
      await loadData();
    } catch (error) {
      setToast(error.message || "Failed to cancel interview.");
    }
    setTimeout(() => setToast(""), 2500);
  }

  async function deleteInterview(id, title) {
    const name = title || "this interview schedule";
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"? This will remove the session from your schedule and candidate portal.`)) return;
    try {
      await api.delete(`/interviews/${id}`);
      setToast("Interview schedule deleted successfully.");
      setMenu(null);
      await loadData();
    } catch (error) {
      setToast(error.message || "Failed to delete interview schedule.");
    }
    setTimeout(() => setToast(""), 3000);
  }

  async function submitDecisionRecord() {
    if (!decisionModal.row) return;
    setDecisionModal(prev => ({ ...prev, loading: true }));
    try {
      await api.post(`/interviews/${decisionModal.row.id}/decision`, {
        decision: decisionModal.type,
        feedback: decisionModal.feedback.trim(),
        strengths: decisionModal.strengths.trim(),
        weaknesses: decisionModal.weaknesses.trim(),
        overall_score: decisionModal.score
      });
      setToast(`Interview concluded. Candidate marked as ${decisionModal.type.toUpperCase()} with feedback.`);
      setDecisionModal({ open: false, row: null, type: "selected", feedback: "", strengths: "", weaknesses: "", score: 85, loading: false });
      await loadData();
    } catch (error) {
      setToast(error.message || "Failed to record hiring decision.");
    } finally {
      setDecisionModal(prev => ({ ...prev, loading: false }));
    }
  }

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="INTERVIEWS"
        title="Interview management"
        description="Schedule sessions, assign candidate slots, and monitor live evaluations."
        action={
          <button className="btn btn-primary" onClick={openSchedule} disabled={!candidates.length || !jobs.length}>
            <Plus size={16} /> Schedule interview
          </button>
        }
      />

      <section className="card company-calendar">
        <div className="calendar-header">
          <div>
            <h3>Interview calendar</h3>
            <p>{monthName} {year} · Select a day to review scheduled sessions.</p>
          </div>
          <div className="calendar-nav">
            <button className="icon-btn" aria-label="Previous month" title="Previous month" onClick={() => changeMonth(-1)}>
              <ChevronLeft size={16} />
            </button>
            <b>{monthName} {year}</b>
            <button className="icon-btn" aria-label="Next month" title="Next month" onClick={() => changeMonth(1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="calendar-weekdays">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="calendar-month-grid">
          {Array.from({ length: firstWeekday }, (_, index) => (
            <span className="calendar-blank" key={`blank-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const event = interviewsByDay[`${year}-${month}-${day}`];
            return (
              <button
                type="button"
                className={`calendar-date ${selectedDay === day ? "selected" : ""} ${event ? "has-event" : ""}`}
                onClick={() => setSelectedDay(day)}
                key={day}
              >
                <b>{day}</b>
                {event && <small>{event} interview{event > 1 ? "s" : ""}</small>}
              </button>
            );
          })}
        </div>
        <p className="calendar-selection">
          <CalendarDays size={15} />{" "}
          {selectedInterviewCount
            ? `${selectedInterviewCount} interview(s) on ${monthName} ${selectedDay}, ${year}`
            : `No interviews scheduled on ${monthName} ${selectedDay}, ${year}`}
        </p>
      </section>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Position</th>
                <th>Date & time</th>
                <th>Round</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const candidate = row.candidate || row.profiles || candidates.find(c => c.id === row.candidate_id);
                const candidateName = candidate?.full_name || (row.title?.includes("—") ? row.title.split("—")[1]?.trim() : "") || "Candidate";
                const candidateEmail = candidate?.email || "";
                const date = new Date(row.scheduled_at);
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="person-cell">
                        <span className="avatar" style={{ overflow: "hidden" }}>
                          <img
                            src={getPhoto(candidate, idx)}
                            alt={candidateName}
                            onError={e => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
                            }}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </span>
                        <div>
                          <b>{candidateName}</b>
                          <small>{candidateEmail || candidate?.headline || "Candidate"}</small>
                        </div>
                      </div>
                    </td>
                    <td>{row.jobs?.title || row.title}</td>
                    <td>
                      <span className="meta-inline">
                        <CalendarDays size={14} />
                        {date.toLocaleString()}
                      </span>
                    </td>
                    <td>{row.type}</td>
                    <td>{row.duration_minutes} min</td>
                    <td>
                      <Badge tone={row.status === "live" ? "danger" : row.status === "completed" ? "success" : "info"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td style={{ position: "relative" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <Link
                          className="btn btn-outline"
                          to={`/interviewer/live?interview=${row.id}`}
                          title="Open live interview monitoring"
                        >
                          <PlayCircle size={14} /> Open
                        </Link>
                        <button
                          className="icon-btn"
                          aria-label={`Delete schedule ${row.title}`}
                          title="Delete interview schedule"
                          onClick={() => deleteInterview(row.id, row.title)}
                          style={{ color: "#ef4444" }}
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Open actions for ${row.title}`}
                          title="More actions"
                          onClick={() => setMenu(menu === row.id ? null : row.id)}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </div>

                      {menu === row.id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "36px",
                            right: "10px",
                            background: "#1e2238",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "8px",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                            zIndex: 10,
                            display: "flex",
                            flexDirection: "column",
                            minWidth: "160px",
                            overflow: "hidden",
                          }}
                        >
                          {row.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => {
                                setDecisionModal({
                                  open: true,
                                  row,
                                  type: "selected",
                                  feedback: "",
                                  strengths: "",
                                  weaknesses: "",
                                  score: 85,
                                  loading: false
                                });
                                setMenu(null);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                color: "#10b981",
                                cursor: "pointer",
                                fontSize: "13px",
                                textAlign: "left",
                              }}
                            >
                              <CheckCircle2 size={14} /> End & Record Decision
                            </button>
                          )}
                          {row.status !== "cancelled" && (
                            <button
                              type="button"
                              onClick={() => cancelInterview(row.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "10px 14px",
                                background: "none",
                                border: "none",
                                color: "#f59e0b",
                                cursor: "pointer",
                                fontSize: "13px",
                                textAlign: "left",
                              }}
                            >
                              <Ban size={14} /> Cancel Session
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => deleteInterview(row.id, row.title)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "10px 14px",
                              background: "none",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              fontSize: "13px",
                              textAlign: "left",
                            }}
                          >
                            <Trash2 size={14} /> Delete Schedule
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <p className="empty-state">No interviews scheduled yet.</p>}
      </section>

      {/* Schedule Interview Modal */}
      <Modal open={open} title="Schedule interview" onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={schedule}>
          <label>
            Candidate
            <select
              value={form.candidate_id}
              onChange={e => {
                const cand = candidates.find(c => c.id === e.target.value);
                const currentJob = jobs.find(j => j.id === form.job_id);
                setForm({
                  ...form,
                  candidate_id: e.target.value,
                  title: `${currentJob?.title || "Position"} — ${cand?.full_name || "Candidate"}`,
                });
              }}
              required
            >
              {candidates.map(candidate => (
                <option value={candidate.id} key={candidate.id}>
                  {candidate.full_name || candidate.email}
                </option>
              ))}
            </select>
          </label>
          {(() => {
            const selectedCand = candidates.find(c => c.id === form.candidate_id);
            if (!selectedCand) return null;
            return (
              <div className="span-2" style={{ display: "flex", alignItems: "center", gap: "12px", background: "var(--cream)", padding: "10px 14px", borderRadius: "10px", marginTop: "-6px" }}>
                <span className="avatar" style={{ overflow: "hidden" }}>
                  <img
                    src={getPhoto(selectedCand)}
                    alt=""
                    onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = DEFAULT_AVATARS[0]; }}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </span>
                <div>
                  <b style={{ fontSize: "13px" }}>{selectedCand.full_name || "Candidate"}</b>
                  <small style={{ display: "block", color: "var(--muted)", fontSize: "11px" }}>{selectedCand.email} · {selectedCand.headline || "Registered Candidate"}</small>
                </div>
              </div>
            );
          })()}
          <label>
            Position
            <select
              value={form.job_id}
              onChange={e => {
                const job = jobs.find(item => item.id === e.target.value);
                const cand = candidates.find(c => c.id === form.candidate_id);
                setForm({
                  ...form,
                  job_id: e.target.value,
                  title: `${job?.title || "Position"} — ${cand?.full_name || "Candidate"}`,
                });
              }}
              required
            >
              {jobs.map(job => (
                <option value={job.id} key={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date and time
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => setForm({ ...form, scheduled_at: e.target.value })}
              required
            />
          </label>
          <label>
            Round
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              <option value="technical">Technical</option>
              <option value="hr">HR</option>
              <option value="technical_hr">Technical + HR</option>
              <option value="system_design">System Design</option>
              <option value="behavioral">Behavioral</option>
            </select>
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
            Instructions for candidate
            <textarea
              value={form.instructions}
              onChange={e => setForm({ ...form, instructions: e.target.value })}
              rows={3}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving || !candidates.length || !jobs.length}>
            {saving ? "Scheduling..." : "Schedule interview"}
          </button>
        </form>
      </Modal>

      {/* Decision & End Session Modal */}
      {decisionModal.open && decisionModal.row && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "580px",
              background: "#fff",
              borderRadius: "18px",
              padding: "24px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "var(--cream)", color: "var(--maroon)", padding: "10px", borderRadius: "12px" }}>
                  <PhoneOff size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>
                    Record Hiring Decision & Feedback
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Candidate: <b>{decisionModal.row.candidate?.full_name || decisionModal.row.title}</b> · {decisionModal.row.jobs?.title || decisionModal.row.title}
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setDecisionModal({ open: false, row: null, type: "selected", feedback: "", strengths: "", weaknesses: "", score: 85, loading: false })}>
                <X size={18} />
              </button>
            </div>

            {/* Decision Selector Cards */}
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              Hiring Decision Outcome:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setDecisionModal(prev => ({ ...prev, type: "selected" }))}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: `2px solid ${decisionModal.type === "selected" ? "#16a34a" : "var(--line)"}`,
                  background: decisionModal.type === "selected" ? "#F0FDF4" : "#FAF5F2",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ background: decisionModal.type === "selected" ? "#16a34a" : "#d1d5db", color: "#fff", padding: "8px", borderRadius: "8px" }}>
                  <ThumbsUp size={18} />
                </div>
                <div>
                  <b style={{ color: decisionModal.type === "selected" ? "#15803d" : "var(--ink)", display: "block", fontSize: "14px" }}>
                    Selected (Hired)
                  </b>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Candidate passed the assessment</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecisionModal(prev => ({ ...prev, type: "rejected" }))}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: `2px solid ${decisionModal.type === "rejected" ? "#ef4444" : "var(--line)"}`,
                  background: decisionModal.type === "rejected" ? "#FEF2F2" : "#FAF5F2",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ background: decisionModal.type === "rejected" ? "#ef4444" : "#d1d5db", color: "#fff", padding: "8px", borderRadius: "8px" }}>
                  <ThumbsDown size={18} />
                </div>
                <div>
                  <b style={{ color: decisionModal.type === "rejected" ? "#b91c1c" : "var(--ink)", display: "block", fontSize: "14px" }}>
                    Rejected (Not Moving Forward)
                  </b>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Provide constructive guidance</span>
                </div>
              </button>
            </div>

            {/* Overall Score Slider */}
            <div style={{ background: "#FAF5F2", padding: "12px 16px", borderRadius: "12px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700" }}>Overall Assessment Score:</span>
                <b style={{ fontSize: "14px", color: decisionModal.score >= 70 ? "#16a34a" : "#ea580c" }}>{decisionModal.score} / 100</b>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={decisionModal.score}
                onChange={e => setDecisionModal(prev => ({ ...prev, score: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: decisionModal.type === "selected" ? "#16a34a" : "#ef4444", cursor: "pointer" }}
              />
            </div>

            {/* Overall Feedback Textarea */}
            <label style={{ display: "block", marginBottom: "12px", fontSize: "12px", fontWeight: "700" }}>
              Overall Feedback & Evaluation Summary:
              <textarea
                rows={3}
                value={decisionModal.feedback}
                onChange={e => setDecisionModal(prev => ({ ...prev, feedback: e.target.value }))}
                placeholder={
                  decisionModal.type === "selected"
                    ? "e.g. Demonstrated exceptional problem-solving depth, clear React architectural knowledge, and collaborative communication."
                    : "e.g. Good fundamentals; recommend deepening hands-on knowledge in asynchronous execution and system design tradeoffs."
                }
                style={{
                  width: "100%",
                  marginTop: "4px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  resize: "vertical"
                }}
              />
            </label>

            {/* Strengths & Areas to Improve Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700" }}>
                Key Strengths:
                <input
                  type="text"
                  value={decisionModal.strengths}
                  onChange={e => setDecisionModal(prev => ({ ...prev, strengths: e.target.value }))}
                  placeholder="e.g. Problem decomposition, clear explanations"
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    fontSize: "12px"
                  }}
                />
              </label>
              <label style={{ fontSize: "12px", fontWeight: "700" }}>
                Areas for Improvement:
                <input
                  type="text"
                  value={decisionModal.weaknesses}
                  onChange={e => setDecisionModal(prev => ({ ...prev, weaknesses: e.target.value }))}
                  placeholder="e.g. Edge case handling, structured walkthroughs"
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    fontSize: "12px"
                  }}
                />
              </label>
            </div>

            <div style={{ background: "#F3F4F6", padding: "10px 14px", borderRadius: "10px", marginBottom: "18px", fontSize: "11px", color: "var(--muted)" }}>
              ℹ️ <b>Candidate Notification:</b> Submitting this evaluation will complete the interview, update the application, and notify the candidate in real time.
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-outline"
                onClick={() => setDecisionModal({ open: false, row: null, type: "selected", feedback: "", strengths: "", weaknesses: "", score: 85, loading: false })}
                disabled={decisionModal.loading}
              >
                Cancel
              </button>
              <button
                className={`btn ${decisionModal.type === "selected" ? "btn-primary" : "btn-danger"}`}
                onClick={submitDecisionRecord}
                disabled={decisionModal.loading}
                style={{
                  background: decisionModal.type === "selected" ? "#16a34a" : "#ef4444",
                  borderColor: decisionModal.type === "selected" ? "#16a34a" : "#ef4444",
                  fontWeight: "700"
                }}
              >
                {decisionModal.loading ? "Saving..." : `Conclude & Mark ${decisionModal.type === "selected" ? "Selected" : "Rejected"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}