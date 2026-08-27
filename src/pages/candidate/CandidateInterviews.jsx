import {
  CalendarDays,
  Clock3,
  Video,
  ArrowRight,
  Radio,
  UserRound,
  FileText,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  MonitorCheck,
  X,
  Timer,
  BookOpen
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

function formatCountdown(scheduledAt, status) {
  if (status === "live") return "Interview is live";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";

  const diffMs = new Date(scheduledAt).getTime() - Date.now();
  if (diffMs <= 0) return "Starting momentarily";

  const totalSecs = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (days > 0) {
    return `Starts in: ${days}d ${hours}h ${mins}m`;
  }
  if (hours > 0) {
    return `Starts in: ${hours}h ${mins}m`;
  }
  if (mins > 0) {
    return `Starts in ${mins}m ${secs}s`;
  }
  return `Starts in ${secs}s`;
}

function safeDateParts(dateStr) {
  if (!dateStr) return { day: "—", month: "TBD" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "—", month: "TBD" };
  try {
    return {
      day: d.getDate(),
      month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
    };
  } catch {
    return { day: "—", month: "TBD" };
  }
}

function safeFormatDate(dateStr, options = { month: "short", day: "numeric", year: "numeric" }) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TBD";
  try {
    return d.toLocaleDateString("en-US", options);
  } catch {
    return "TBD";
  }
}

function safeFormatTime(dateStr, options = { hour: "numeric", minute: "2-digit" }) {
  if (!dateStr) return "TBD";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "TBD";
  try {
    return d.toLocaleTimeString("en-US", options);
  } catch {
    return "TBD";
  }
}

function formatStatusBadge(status) {
  switch (status) {
    case "live":
      return <Badge tone="danger"><span className="live-dot" /> Live</Badge>;
    case "completed":
      return <Badge tone="success"><CheckCircle2 size={12} /> Completed</Badge>;
    case "cancelled":
      return <Badge tone="neutral">Cancelled</Badge>;
    case "scheduled":
    default:
      return <Badge tone="warning"><Clock3 size={12} /> Scheduled</Badge>;
  }
}

export default function CandidateInterviews() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("All");
  const [interviews, setInterviews] = useState([]);
  const [practiceTests, setPracticeTests] = useState([]);
  const [practiceAttempts, setPracticeAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [now, setNow] = useState(Date.now());

  const loadData = async () => {
    setErrorMsg("");
    try {
      const [interviewsRes, practiceRes, attemptsRes] = await Promise.allSettled([
        api.get("/interviews"),
        api.get("/practice-tests"),
        api.get("/practice-tests/attempts"),
      ]);

      if (interviewsRes.status === "fulfilled") {
        setInterviews(Array.isArray(interviewsRes.value) ? interviewsRes.value : (interviewsRes.value?.data || []));
      } else {
        const err = interviewsRes.reason;
        if (err?.status === 401) {
          setErrorMsg("Your session has expired. Please log in again.");
        } else if (!navigator.onLine || err?.message?.includes("network") || err?.message?.includes("Failed to fetch")) {
          setErrorMsg("Unable to connect to the server. Please make sure the backend is running.");
        } else {
          setErrorMsg("Unable to load interviews. Please try again.");
        }
      }

      if (practiceRes.status === "fulfilled") {
        setPracticeTests(Array.isArray(practiceRes.value) ? practiceRes.value : (practiceRes.value?.data || []));
      }
      if (attemptsRes.status === "fulfilled") {
        setPracticeAttempts(Array.isArray(attemptsRes.value) ? attemptsRes.value : (attemptsRes.value?.data || []));
      }
    } catch {
      setErrorMsg("Unable to load interviews. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToTable("interviews", null, loadData);
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Tick countdown timer every second
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const upcomingInterviews = interviews
    .filter(i => i.status === "scheduled" || i.status === "live")
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());

  const completedInterviews = interviews
    .filter(i => i.status === "completed")
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  const liveInterviews = interviews.filter(i => i.status === "live");

  // Sorted list for "All" tab: live & scheduled first ascending, then completed & cancelled descending
  const allInterviews = [
    ...upcomingInterviews,
    ...interviews.filter(i => i.status === "cancelled"),
    ...completedInterviews,
  ];

  const counts = {
    All: interviews.length,
    Upcoming: upcomingInterviews.length,
    Completed: completedInterviews.length,
    Practice: practiceTests.length,
  };

  const getVisibleList = () => {
    if (filter === "All") return allInterviews;
    if (filter === "Upcoming") return upcomingInterviews;
    if (filter === "Completed") return completedInterviews;
    return [];
  };

  const visibleInterviews = getVisibleList();

  return (
    <div>
      <SectionTitle
        eyebrow="INTERVIEWS"
        title="My Interviews"
        description="View your scheduled sessions, live rooms, completed evaluations, and practice assessments."
      />

      {/* Live Room Alert Banner */}
      {liveInterviews.length > 0 && (
        <div
          className="card"
          style={{
            background: "linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.05))",
            borderColor: "rgba(239, 68, 68, 0.4)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 10px #ef4444" }} />
            <div>
              <b style={{ fontSize: "14px", color: "var(--ink)" }}>
                Interviewer has started the interview: {liveInterviews[0].title}
              </b>
              <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                The live video workspace and coding room are open.
              </p>
            </div>
          </div>
          <Link to={`/candidate/live?interview=${liveInterviews[0].id}`} className="btn btn-primary">
            <Radio size={16} /> Join Interview Now
          </Link>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="filter-row" style={{ marginBottom: "20px" }}>
        {["All", "Upcoming", "Completed", "Practice"].map(item => (
          <button
            key={item}
            className={`filter ${filter === item ? "active" : ""}`}
            onClick={() => setFilter(item)}
            type="button"
          >
            {item} ({counts[item] || 0})
          </button>
        ))}
      </div>

      {/* Error state */}
      {errorMsg && (
        <div className="card" style={{ borderColor: "var(--danger)", color: "var(--danger)", padding: "16px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertCircle size={18} />
            <b>{errorMsg}</b>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: "auto" }} onClick={loadData}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="empty-state">
          <p>Loading your interviews...</p>
        </div>
      ) : filter === "Practice" ? (
        /* Practice Tests Tab */
        <div>
          {practiceTests.length === 0 ? (
            <div className="empty-state">
              <h3>No practice tests available</h3>
              <p style={{ marginTop: "6px" }}>Practice assessments will appear here.</p>
            </div>
          ) : (
            <>
              <div className="cards-2">
                {practiceTests.map(test => {
                  const pastAttempt = practiceAttempts.find(a => a.test_id === test.id && a.submitted_at);
                  const qCount = (test.questions || []).length;
                  return (
                    <div className="card test-card" key={test.id}>
                      <div className="feature-icon">
                        <BookOpen size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="card-head" style={{ marginBottom: "6px" }}>
                          <h3>{test.title}</h3>
                          {pastAttempt && (
                            <Badge tone={pastAttempt.score >= 70 ? "success" : "info"}>
                              Score: {pastAttempt.score}%
                            </Badge>
                          )}
                        </div>
                        <p>{test.description || "Timed technical assessment."}</p>
                        <div className="meta-row" style={{ marginTop: "10px" }}>
                          <span><Timer size={14} /> {test.duration_minutes || 20} min</span>
                          <span><Sparkles size={14} /> {qCount} questions</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-primary"
                        onClick={() => navigate("/candidate/practice")}
                      >
                        Start <ArrowRight size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {practiceAttempts.length > 0 && (
                <section className="card" style={{ marginTop: "24px" }}>
                  <div className="card-head">
                    <div>
                      <h3>Recent Practice Attempts</h3>
                      <p>Your previous practice test scores</p>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Assessment</th>
                          <th>Date</th>
                          <th>Score</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practiceAttempts.slice(0, 5).map(attempt => (
                          <tr key={attempt.id}>
                            <td><b>{attempt.practice_tests?.title || "Practice Test"}</b></td>
                            <td>{new Date(attempt.started_at).toLocaleDateString()}</td>
                            <td>
                              <strong>{attempt.score != null ? `${attempt.score}%` : "In progress"}</strong>
                            </td>
                            <td>
                              <Badge tone={attempt.submitted_at ? (attempt.score >= 70 ? "success" : "info") : "warning"}>
                                {attempt.submitted_at ? "Completed" : "Incomplete"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      ) : (
        /* Real Interviews List */
        <div className="interview-list">
          {visibleInterviews.map(i => {
            const isLive = i.status === "live";
            const isScheduled = i.status === "scheduled";
            const isCompleted = i.status === "completed";
            const dateParts = safeDateParts(i.scheduled_at);
            const dateLabel = safeFormatDate(i.scheduled_at);
            const timeLabel = safeFormatTime(i.scheduled_at);
            const interviewerName =
              i.interviewer?.full_name ||
              i.interviewer?.company ||
              "Interviewer";
            const positionTitle = i.jobs?.title || i.title;
            const roundType = i.type
              ? `${i.type.charAt(0).toUpperCase() + i.type.slice(1)} Round`
              : "Technical Round";
            const hasResults = (i.interview_results || []).length > 0;
            const countdownText = formatCountdown(i.scheduled_at, i.status);

            return (
              <div
                className={`card interview-row ${isLive ? "interview-live-row" : ""}`}
                key={i.id}
                style={{
                  borderLeft: isLive
                    ? "4px solid #ef4444"
                    : isScheduled
                    ? "4px solid var(--maroon)"
                    : "1px solid var(--line)",
                }}
              >
                {/* Date Tile */}
                <div className="date-tile small">
                  <b>{dateParts.day}</b>
                  <span>{dateParts.month}</span>
                </div>

                {/* Main Info */}
                <div className="interview-info" style={{ flex: 1 }}>
                  <div className="interview-title-line" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <h3>{i.title}</h3>
                    {formatStatusBadge(i.status)}
                    {isCompleted && hasResults && (() => {
                      const res = Array.isArray(i.interview_results) ? i.interview_results[0] : i.interview_results;
                      if (res?.recommendation === "strong_hire" || res?.recommendation === "hire") {
                        return <Badge tone="success" style={{ fontWeight: "700" }}><CheckCircle2 size={12} /> Selected</Badge>;
                      }
                      if (res?.recommendation === "no_hire") {
                        return <Badge tone="danger" style={{ fontWeight: "700" }}><X size={12} /> Not Selected</Badge>;
                      }
                      return null;
                    })()}
                    {isScheduled && (
                      <span className="badge badge-info" style={{ fontSize: "10px" }}>
                        <Clock3 size={11} /> {countdownText}
                      </span>
                    )}
                  </div>

                  <p style={{ fontWeight: "600", color: "var(--ink)", marginTop: "2px" }}>
                    {positionTitle} · <span style={{ color: "var(--muted)", fontWeight: "normal" }}>{roundType}</span>
                  </p>

                  <div className="meta-row" style={{ marginTop: "8px" }}>
                    <span><CalendarDays size={14} /> {dateLabel}</span>
                    <span><Clock3 size={14} /> {timeLabel}</span>
                    <span><Video size={14} /> {i.duration_minutes || 60} minutes</span>
                    <span><UserRound size={14} /> Interviewer: {interviewerName}</span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => setSelectedInterview(i)}
                  >
                    View Details
                  </button>

                  {(isLive || isScheduled) && (
                    <Link
                      className="btn btn-primary join-btn"
                      to={`/candidate/live?interview=${i.id}`}
                      style={{
                        background: isLive ? "#ef4444" : "var(--maroon)",
                        borderColor: isLive ? "#ef4444" : "var(--maroon)"
                      }}
                    >
                      <Radio size={15} /> Join Interview
                    </Link>
                  )}

                  {isScheduled && (
                    <Link
                      className="btn btn-outline"
                      to={`/candidate/instructions?interview=${i.id}`}
                    >
                      <Sparkles size={15} /> Prepare
                    </Link>
                  )}

                  {isCompleted && (
                    hasResults ? (
                      <Link
                        className="btn btn-primary"
                        to={`/candidate/results?interview=${i.id}`}
                      >
                        <FileText size={15} /> View Results
                      </Link>
                    ) : (
                      <button className="btn btn-outline" disabled title="Results not published yet">
                        Results Pending
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {visibleInterviews.length === 0 && (
            <div className="empty-state">
              <h3>
                {filter === "All"
                  ? "No interviews found"
                  : filter === "Upcoming"
                  ? "No upcoming interviews"
                  : "No completed interviews"}
              </h3>
              <p style={{ marginTop: "6px" }}>
                {filter === "All"
                  ? "Your scheduled and completed interviews will appear here."
                  : filter === "Upcoming"
                  ? "Your next scheduled interview will appear here."
                  : "Completed interviews and results will appear here."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Joining a Live Interview Info Callout */}
      <div className="candidate-join-note" style={{ marginTop: "24px" }}>
        <Radio size={20} />
        <div>
          <b>Joining a live interview</b>
          <p>
            When the interviewer opens the room, the Join Interview button becomes active. It will configure your camera, microphone, screen-sharing, and interactive assessment room.
          </p>
        </div>
      </div>

      {/* Interview Details Modal */}
      {selectedInterview && (
        <div className="modal-backdrop" onClick={() => setSelectedInterview(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div className="modal-head">
              <div>
                <span className="eyebrow">INTERVIEW DETAILS</span>
                <h2>{selectedInterview.title}</h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSelectedInterview(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid var(--line)" }}>
                <div>
                  <b style={{ fontSize: "15px" }}>
                    {selectedInterview.jobs?.title || selectedInterview.title}
                  </b>
                  <p style={{ fontSize: "12px", color: "var(--muted)", margin: "2px 0 0" }}>
                    {selectedInterview.jobs?.department ? `${selectedInterview.jobs.department} · ` : ""}
                    {selectedInterview.type ? `${selectedInterview.type.toUpperCase()} ROUND` : "TECHNICAL ROUND"}
                  </p>
                </div>
                {formatStatusBadge(selectedInterview.status)}
              </div>

              <div className="form-grid" style={{ marginBottom: 0 }}>
                <div>
                  <span className="muted" style={{ fontSize: "11px" }}>Date & Time</span>
                  <p style={{ fontWeight: "600", color: "var(--ink)", marginTop: "3px" }}>
                    {safeFormatDate(selectedInterview.scheduled_at, {
                      weekday: "short",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {safeFormatTime(selectedInterview.scheduled_at)}
                  </p>
                </div>

                <div>
                  <span className="muted" style={{ fontSize: "11px" }}>Session Duration</span>
                  <p style={{ fontWeight: "600", color: "var(--ink)", marginTop: "3px" }}>
                    {selectedInterview.duration_minutes || 60} minutes
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                    {formatCountdown(selectedInterview.scheduled_at, selectedInterview.status)}
                  </p>
                </div>

                <div>
                  <span className="muted" style={{ fontSize: "11px" }}>Interviewer</span>
                  <p style={{ fontWeight: "600", color: "var(--ink)", marginTop: "3px" }}>
                    {selectedInterview.interviewer?.full_name || selectedInterview.interviewer?.company || "Interviewer"}
                  </p>
                  {selectedInterview.interviewer?.email && (
                    <p style={{ fontSize: "12px", color: "var(--muted)" }}>
                      {selectedInterview.interviewer.email}
                    </p>
                  )}
                </div>

                <div>
                  <span className="muted" style={{ fontSize: "11px" }}>Meeting Room Status</span>
                  <p style={{ fontWeight: "600", color: "var(--ink)", marginTop: "3px" }}>
                    {selectedInterview.status === "live" ? "Room is Open" : "Scheduled"}
                  </p>
                </div>
              </div>

              {/* Feedback and Outcome Section if Completed */}
              {selectedInterview.status === "completed" && (() => {
                const res = Array.isArray(selectedInterview.interview_results) ? selectedInterview.interview_results[0] : selectedInterview.interview_results;
                if (!res) return null;
                const isSel = res.recommendation === "strong_hire" || res.recommendation === "hire";
                const isRej = res.recommendation === "no_hire";
                return (
                  <div style={{ background: isSel ? "#F0FDF4" : isRej ? "#FEF2F2" : "#FAF5F2", border: `1px solid ${isSel ? "#BBF7D0" : isRej ? "#FECACA" : "var(--line)"}`, padding: "16px", borderRadius: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <b style={{ fontSize: "13px", color: isSel ? "#15803D" : isRej ? "#B91C1C" : "var(--ink)" }}>
                        {isSel ? "Hiring Outcome: SELECTED" : isRej ? "Hiring Outcome: NOT SELECTED" : "Evaluation Completed"}
                      </b>
                      {res.overall_score != null && (
                        <Badge tone={isSel ? "success" : "neutral"}>
                          Score: {res.overall_score}/100
                        </Badge>
                      )}
                    </div>
                    {res.summary && (
                      <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#374151", lineHeight: "1.5" }}>
                        <b>Feedback:</b> {res.summary}
                      </p>
                    )}
                    {res.strengths && (
                      <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#166534" }}>
                        <b>Strengths:</b> {res.strengths}
                      </p>
                    )}
                    {res.weaknesses && (
                      <p style={{ margin: "0", fontSize: "12px", color: "#991B1B" }}>
                        <b>Areas to improve:</b> {res.weaknesses}
                      </p>
                    )}
                  </div>
                );
              })()}

              <div style={{ background: "var(--cream)", padding: "14px", borderRadius: "10px" }}>
                <b style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", color: "var(--ink)" }}>
                  <Info size={15} /> Preparation Instructions:
                </b>
                <p style={{ fontSize: "12px", marginTop: "6px", color: "var(--ink)", lineHeight: "1.5" }}>
                  {selectedInterview.instructions ||
                    "Please ensure you are in a quiet, well-lit environment with a working webcam, microphone, and stable internet connection. Keep any reference materials ready."}
                </p>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px", flexWrap: "wrap" }}>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setSelectedInterview(null)}
                >
                  Close
                </button>
                {selectedInterview.status === "completed" && (
                  <Link
                    className="btn btn-primary"
                    to={`/candidate/results?interview=${selectedInterview.id}`}
                    onClick={() => setSelectedInterview(null)}
                  >
                    <FileText size={15} /> View Full Results & Evaluation
                  </Link>
                )}
                {(selectedInterview.status === "live" || selectedInterview.status === "scheduled") && (
                  <>
                    <button
                      className="btn btn-outline"
                      type="button"
                      onClick={() => {
                        setSelectedInterview(null);
                        navigate("/candidate/system-check");
                      }}
                    >
                      <MonitorCheck size={15} /> System Check
                    </button>
                    <Link
                      className="btn btn-primary"
                      to={`/candidate/live?interview=${selectedInterview.id}`}
                      onClick={() => setSelectedInterview(null)}
                      style={{
                        background: selectedInterview.status === "live" ? "#ef4444" : "var(--maroon)",
                        borderColor: selectedInterview.status === "live" ? "#ef4444" : "var(--maroon)"
                      }}
                    >
                      <Radio size={15} /> Join Interview
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}