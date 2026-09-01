import { useEffect, useState, useCallback, useMemo } from "react";
import { CalendarDays, Plus, Clock3, Video, Users, MoreHorizontal, ChevronLeft, ChevronRight, Ban, PlayCircle, ThumbsUp, ThumbsDown, CheckCircle2, PhoneOff, X, Trash2, Calendar as CalendarIcon, Sparkles, Filter, Search } from "lucide-react";
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
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
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
      const pad = n => String(n).padStart(2, "0");
      const defaultDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
      const defaultTime = "10:00";

      setForm({
        candidate_id: targetCandidate?.id || "",
        job_id: targetJob?.id || "",
        title: targetJob ? `${targetJob.title} — ${targetCandidate?.full_name || "Interview"}` : "Technical Interview",
        type: "technical",
        date: defaultDate,
        time: defaultTime,
        duration_minutes: 60,
        instructions: "Please be ready with a quiet environment and working camera.",
      });
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, candidates, jobs, setSearchParams]);

  const today = useMemo(() => new Date(), []);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString("en-US", { month: "long" });

  const formatDateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  // Group interviews by date key
  const interviewsByDate = useMemo(() => {
    const map = {};
    rows.forEach(row => {
      if (!row.scheduled_at) return;
      const d = new Date(row.scheduled_at);
      if (isNaN(d.getTime())) return;
      const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return map;
  }, [rows]);

  const selectedDateKey = formatDateKey(year, month, selectedDay);
  const selectedDayInterviews = interviewsByDate[selectedDateKey] || [];

  // Generate complete 35/42 calendar matrix
  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells = [];

    // Trailing days from previous month
    for (let i = firstWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const key = formatDateKey(prevDate.getFullYear(), prevDate.getMonth(), dayNum);
      cells.push({
        day: dayNum,
        year: prevDate.getFullYear(),
        month: prevDate.getMonth(),
        isOtherMonth: true,
        key,
        events: interviewsByDate[key] || []
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const key = formatDateKey(year, month, d);
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
      const isSelected = selectedDay === d;
      cells.push({
        day: d,
        year,
        month,
        isOtherMonth: false,
        isToday,
        isSelected,
        key,
        events: interviewsByDate[key] || []
      });
    }

    // Leading days from next month
    const remaining = (cells.length % 7 === 0) ? 0 : 7 - (cells.length % 7);
    for (let n = 1; n <= remaining; n++) {
      const nextDate = new Date(year, month + 1, n);
      const key = formatDateKey(nextDate.getFullYear(), nextDate.getMonth(), n);
      cells.push({
        day: n,
        year: nextDate.getFullYear(),
        month: nextDate.getMonth(),
        isOtherMonth: true,
        key,
        events: interviewsByDate[key] || []
      });
    }

    return cells;
  }, [year, month, selectedDay, interviewsByDate, today]);

  function changeMonth(offset) {
    setCalendarDate(new Date(year, month + offset, 1));
    setSelectedDay(1);
  }

  function jumpToToday() {
    const now = new Date();
    setCalendarDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDay(now.getDate());
  }

  function openScheduleForDate(y, m, d) {
    const pad = n => String(n).padStart(2, "0");
    const targetDate = `${y}-${pad(m + 1)}-${pad(d)}`;
    const defaultTime = "10:00";
    const defaultJob = jobs[0];
    const defaultCandidate = candidates[0];

    setForm({
      candidate_id: defaultCandidate?.id || "",
      job_id: defaultJob?.id || "",
      title: defaultJob ? `${defaultJob.title} — ${defaultCandidate?.full_name || "Interview"}` : "Technical Interview",
      type: "technical",
      date: targetDate,
      time: defaultTime,
      duration_minutes: 60,
      instructions: "Please be ready with a quiet environment and working camera.",
    });
    setOpen(true);
  }

  function openSchedule() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = n => String(n).padStart(2, "0");
    const defaultDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
    const defaultTime = "10:00";

    const defaultJob = jobs[0];
    const defaultCandidate = candidates[0];

    setForm({
      candidate_id: defaultCandidate?.id || "",
      job_id: defaultJob?.id || "",
      title: defaultJob ? `${defaultJob.title} — ${defaultCandidate?.full_name || "Interview"}` : "Technical Interview",
      type: "technical",
      date: defaultDate,
      time: defaultTime,
      duration_minutes: 60,
      instructions: "Please be ready with a quiet environment and working camera.",
    });
    setOpen(true);
  }

  async function schedule(event) {
    event.preventDefault();
    if (!form.candidate_id || !form.job_id || !form.date || !form.time) {
      setToast("Please fill in all required scheduling details including date and time.");
      return;
    }

    setSaving(true);
    try {
      const formattedTime = form.time.length === 5 ? `${form.time}:00` : form.time;
      const dateObj = new Date(`${form.date}T${formattedTime}`);
      const scheduledIso = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

      await api.post("/interviews", {
        candidate_id: form.candidate_id,
        job_id: form.job_id,
        title: form.title,
        type: form.type,
        scheduled_at: scheduledIso,
        duration_minutes: form.duration_minutes,
        instructions: form.instructions,
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

  // Filtered rows for the directory table
  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cand = row.candidate || row.profiles || {};
        const nameMatch = (cand.full_name || "").toLowerCase().includes(q);
        const titleMatch = (row.title || "").toLowerCase().includes(q);
        const jobMatch = (row.jobs?.title || "").toLowerCase().includes(q);
        if (!nameMatch && !titleMatch && !jobMatch) return false;
      }
      return true;
    });
  }, [rows, filterStatus, searchQuery]);

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="INTERVIEWS"
        title="Interview Management"
        description="Schedule sessions, manage interactive calendar slots, and review live candidate evaluations."
        action={
          <button className="btn btn-primary" onClick={openSchedule} disabled={!candidates.length || !jobs.length}>
            <Plus size={16} /> Schedule interview
          </button>
        }
      />

      {/* Compact Interactive Calendar & Day Agenda Split View */}
      <div className="calendar-section-split">
        {/* Left: Compact Calendar Card */}
        <section className="calendar-card">
          <div className="calendar-toolbar">
            <div className="calendar-title-wrap">
              <h2>{monthName} {year}</h2>
              <button className="btn btn-outline btn-sm" onClick={jumpToToday} style={{ padding: "4px 8px", fontSize: "11px" }}>
                Today
              </button>
            </div>

            <div className="calendar-controls">
              <button
                className="icon-btn"
                aria-label="Previous month"
                title="Previous month"
                onClick={() => changeMonth(-1)}
                style={{ width: "30px", height: "30px" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                className="icon-btn"
                aria-label="Next month"
                title="Next month"
                onClick={() => changeMonth(1)}
                style={{ width: "30px", height: "30px" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* 7-Day Grid Headers */}
          <div className="calendar-grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => (
              <div key={day} className="calendar-header-cell">
                {day}
              </div>
            ))}

            {/* Calendar Day Cells */}
            {calendarCells.map((cell, idx) => {
              const isSel = !cell.isOtherMonth && selectedDay === cell.day;
              const hasEvents = cell.events.length > 0;

              return (
                <div
                  key={`${cell.key}-${idx}`}
                  className={`calendar-day-cell ${cell.isOtherMonth ? "other-month" : ""} ${cell.isToday ? "today" : ""} ${isSel ? "selected" : ""}`}
                  onClick={() => {
                    if (cell.isOtherMonth) {
                      setCalendarDate(new Date(cell.year, cell.month, 1));
                    }
                    setSelectedDay(cell.day);
                  }}
                >
                  <div className="calendar-cell-top">
                    <span className="calendar-day-number">{cell.day}</span>
                    <button
                      className="calendar-add-quick-btn"
                      title={`Schedule interview on ${cell.year}-${cell.month + 1}-${cell.day}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openScheduleForDate(cell.year, cell.month, cell.day);
                      }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>

                  {/* Compact Event Dots */}
                  {hasEvents && (
                    <div className="calendar-events-dots">
                      {cell.events.slice(0, 3).map((evt) => (
                        <span
                          key={evt.id}
                          className={`calendar-event-dot-mini ${evt.status || "scheduled"}`}
                          title={`${evt.scheduled_at ? new Date(evt.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""} - ${evt.title}`}
                        />
                      ))}
                      {cell.events.length > 3 && (
                        <span style={{ fontSize: "8px", fontWeight: 800, color: "var(--deep-blue)" }}>
                          +{cell.events.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Right: Selected Day Agenda */}
        <section className="calendar-day-agenda-box">
          <div className="calendar-day-agenda-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CalendarIcon size={16} color="var(--deep-blue)" />
              <b style={{ fontSize: "14px", color: "var(--navy)" }}>
                {new Date(year, month, selectedDay).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </b>
              <span className="badge badge-info" style={{ marginLeft: "2px", fontSize: "10px", padding: "2px 8px" }}>
                {selectedDayInterviews.length} {selectedDayInterviews.length === 1 ? "session" : "sessions"}
              </span>
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => openScheduleForDate(year, month, selectedDay)}
              style={{ padding: "5px 12px", fontSize: "11px" }}
            >
              <Plus size={13} /> Add Slot
            </button>
          </div>

          {selectedDayInterviews.length > 0 ? (
            <div className="calendar-agenda-grid">
              {selectedDayInterviews.map((evt, idx) => {
                const cand = evt.candidate || evt.profiles || candidates.find(c => c.id === evt.candidate_id) || {};
                const candName = cand.full_name || evt.title || "Candidate";
                const d = new Date(evt.scheduled_at);
                const timeString = !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Scheduled";

                return (
                  <div key={evt.id} className="calendar-agenda-card">
                    <div className="calendar-agenda-top">
                      <div className="person-cell">
                        <span className="avatar" style={{ overflow: "hidden", width: "32px", height: "32px", fontSize: "10px" }}>
                          <img
                            src={getPhoto(cand, idx)}
                            alt={candName}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </span>
                        <div>
                          <b style={{ fontSize: "13px", color: "var(--navy)" }}>{candName}</b>
                          <small style={{ color: "var(--muted)", display: "block", fontSize: "11px" }}>{evt.jobs?.title || evt.title}</small>
                        </div>
                      </div>
                      <Badge tone={evt.status === "live" ? "danger" : evt.status === "completed" ? "success" : "info"}>
                        {evt.status}
                      </Badge>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11px", color: "var(--muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock3 size={12} color="var(--deep-blue)" /> {timeString} ({evt.duration_minutes || 60}m)
                      </span>
                      <span>·</span>
                      <span style={{ textTransform: "capitalize" }}>{evt.type || "Technical"} Round</span>
                    </div>

                    <div className="calendar-agenda-actions">
                      <Link
                        className="btn btn-primary btn-sm"
                        to={`/interviewer/live?interview=${evt.id}`}
                        style={{ flex: 1, padding: "5px 10px", fontSize: "11px" }}
                      >
                        <PlayCircle size={13} /> Open Session
                      </Link>

                      {evt.status !== "completed" && (
                        <button
                          className="btn btn-outline btn-sm"
                          title="Record decision"
                          onClick={() => {
                            setDecisionModal({
                              open: true,
                              row: evt,
                              type: "selected",
                              feedback: "",
                              strengths: "",
                              weaknesses: "",
                              score: 85,
                              loading: false
                            });
                          }}
                          style={{ padding: "5px 8px" }}
                        >
                          <CheckCircle2 size={13} color="#00537A" />
                        </button>
                      )}

                      <button
                        className="btn btn-outline btn-sm"
                        title="Delete schedule"
                        onClick={() => deleteInterview(evt.id, evt.title)}
                        style={{ color: "#D9381E", padding: "5px 8px" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "24px 16px", textAlign: "center", background: "rgba(247, 251, 253, 0.6)", borderRadius: "12px", border: "1px dashed rgba(0,83,122,0.15)", margin: "auto 0" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
                No interviews scheduled for this date.
              </p>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => openScheduleForDate(year, month, selectedDay)}
                style={{ marginTop: "10px", padding: "5px 12px", fontSize: "11px" }}
              >
                <Plus size={12} /> Schedule on this Date
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Directory Table Section */}
      <section className="card">
        <div className="card-head">
          <div>
            <h3>All Interview Sessions</h3>
            <p>Directory of all scheduled, active, and completed candidate assessments</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <div className="search-box" style={{ width: "240px" }}>
              <Search size={15} />
              <input
                placeholder="Search candidate or job..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filter-row" style={{ marginBottom: "14px" }}>
          {["all", "scheduled", "live", "completed", "cancelled"].map(status => (
            <button
              key={status}
              type="button"
              className={`filter ${filterStatus === status ? "active" : ""}`}
              onClick={() => setFilterStatus(status)}
              style={{ textTransform: "capitalize" }}
            >
              {status} ({status === "all" ? rows.length : rows.filter(r => r.status === status).length})
            </button>
          ))}
        </div>

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
              {filteredRows.map((row, idx) => {
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
                        {!isNaN(date.getTime()) ? date.toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Scheduled"}
                      </span>
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{row.type}</td>
                    <td>{row.duration_minutes} min</td>
                    <td>
                      <Badge tone={row.status === "live" ? "danger" : row.status === "completed" ? "success" : "info"}>
                        {row.status}
                      </Badge>
                    </td>
                    <td style={{ position: "relative" }}>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <Link
                          className="btn btn-outline btn-sm"
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
                          style={{ color: "#D9381E", width: "32px", height: "32px" }}
                        >
                          <Trash2 size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          aria-label={`Open actions for ${row.title}`}
                          title="More actions"
                          onClick={() => setMenu(menu === row.id ? null : row.id)}
                          style={{ width: "32px", height: "32px" }}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </div>

                      {menu === row.id && (
                        <div
                          style={{
                            position: "absolute",
                            top: "36px",
                            right: "10px",
                            background: "rgba(255, 255, 255, 0.95)",
                            backdropFilter: "blur(16px)",
                            border: "1px solid rgba(0, 83, 122, 0.2)",
                            borderRadius: "12px",
                            boxShadow: "0 10px 30px rgba(1,60,88,0.18)",
                            zIndex: 25,
                            display: "flex",
                            flexDirection: "column",
                            minWidth: "180px",
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
                                color: "#00537A",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 600,
                                textAlign: "left",
                              }}
                            >
                              <CheckCircle2 size={14} color="#00537A" /> End & Record Decision
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
                                color: "#F5A201",
                                cursor: "pointer",
                                fontSize: "12px",
                                fontWeight: 600,
                                textAlign: "left",
                              }}
                            >
                              <Ban size={14} color="#F5A201" /> Cancel Session
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
                              color: "#D9381E",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              borderTop: "1px solid rgba(0, 83, 122, 0.08)"
                            }}
                          >
                            <Trash2 size={14} color="#D9381E" /> Delete Permanently
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "28px" }}>
                    <p style={{ margin: 0, color: "var(--muted)" }}>No interviews match the current filter.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
            Interview Date
            <input
              type="date"
              value={form.date || ""}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => setForm({ ...form, date: e.target.value })}
              required
            />
          </label>
          <label>
            Interview Time
            <input
              type="time"
              value={form.time || ""}
              onChange={e => setForm({ ...form, time: e.target.value })}
              required
            />
          </label>

          {/* Quick Time Slot Selector */}
          <div className="span-2" style={{ marginTop: "-6px" }}>
            <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "700", display: "block", marginBottom: "6px" }}>
              Quick Time Slots:
            </span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {[
                { label: "09:00 AM", value: "09:00" },
                { label: "10:00 AM", value: "10:00" },
                { label: "11:30 AM", value: "11:30" },
                { label: "02:00 PM", value: "14:00" },
                { label: "03:30 PM", value: "15:30" },
                { label: "05:00 PM", value: "17:00" }
              ].map(slot => (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, time: slot.value }))}
                  className={`btn btn-sm ${form.time === slot.value ? "btn-primary" : "btn-outline"}`}
                  style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "6px" }}
                >
                  {slot.label}
                </button>
              ))}
            </div>
          </div>

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