import { useEffect, useState, useCallback } from "react";
import { CalendarDays, Plus, Clock3, Video, Users, MoreHorizontal, ChevronLeft, ChevronRight, Ban, PlayCircle } from "lucide-react";
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
  const url = c?.avatar_url;
  if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:"))) {
    return url;
  }
  return DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
}

export default function InterviewManagement() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(null);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

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
                            minWidth: "140px",
                            overflow: "hidden",
                          }}
                        >
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
                              color: "#ef4444",
                              cursor: "pointer",
                              fontSize: "13px",
                              textAlign: "left",
                            }}
                          >
                            <Ban size={14} /> Cancel Session
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
    </div>
  );
}