import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Send,
  Plus,
  Mail,
  Clock,
  Inbox,
  SendHorizontal,
  CheckCheck,
  Briefcase,
  ArrowRight
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import Modal from "../../components/Modal";
import Toast from "../../components/Toast";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function InterviewerNotifications() {
  const [activeTab, setActiveTab] = useState("inbox"); // 'inbox' | 'sent'
  const [notifications, setNotifications] = useState([]);
  const [sentNotifications, setSentNotifications] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);

  const [form, setForm] = useState({
    candidate_id: "",
    title: "",
    message: "",
    type: "info",
  });

  const loadData = useCallback(() => {
    Promise.all([
      api.get("/notifications"),
      api.get("/notifications/sent").catch(() => ({ data: [] })),
      api.get("/profiles/candidates").catch(() => ({ data: [] })),
    ])
      .then(([notifRes, sentRes, candidateRes]) => {
        setNotifications(notifRes.data || []);
        setSentNotifications(sentRes.data || []);
        setCandidates(candidateRes.data || []);
      })
      .catch(err => setToast(err.message));
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToTable("notifications", null, loadData);
    return () => unsub();
  }, [loadData]);

  function openSendModal() {
    setForm({
      candidate_id: candidates[0]?.id || "",
      title: "",
      message: "",
      type: "info",
    });
    setSendOpen(true);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!form.candidate_id || !form.title.trim() || !form.message.trim()) {
      setToast("Please fill in candidate, title and message.");
      return;
    }
    setSending(true);
    try {
      await api.post("/notifications", {
        recipient_id: form.candidate_id,
        candidate_id: form.candidate_id,
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
      });
      setSendOpen(false);
      setToast("Notification sent to candidate successfully!");
      setActiveTab("sent");
      await loadData();
    } catch (err) {
      setToast(err.message || "Failed to send notification.");
    } finally {
      setSending(false);
      setTimeout(() => setToast(""), 3500);
    }
  }

  async function markAllRead() {
    try {
      await api.post("/notifications/read-all");
      setToast("All notifications marked as read.");
      await loadData();
    } catch (err) {
      setToast(err.message || "Failed to mark notifications.");
    }
    setTimeout(() => setToast(""), 2200);
  }

  async function markSingleRead(id) {
    try {
      await api.post(`/notifications/${id}/read`);
      await loadData();
    } catch {
      // quiet
    }
  }

  const navigate = useNavigate();

  const getIcon = type => {
    switch (type) {
      case "job_application":
      case "job_app":
        return Briefcase;
      case "interview_scheduled":
      case "calendar":
        return CalendarDays;
      case "integrity_alert":
      case "warning":
        return ShieldAlert;
      case "recommendation":
      case "success":
        return Sparkles;
      default:
        return Bell;
    }
  };

  const getTone = type => {
    switch (type) {
      case "job_application":
      case "job_app":
        return "success";
      case "success":
      case "recommendation":
        return "success";
      case "warning":
      case "integrity_alert":
        return "warning";
      case "interview_scheduled":
      case "calendar":
        return "info";
      default:
        return "neutral";
    }
  };

  const unreadCount = notifications.filter(n => !n.read_at).length;

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="NOTIFICATIONS"
        title="Company Notifications"
        description="Stay up to date with interview activities, candidate messages, and send updates directly to candidates."
        action={
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              className="btn btn-outline"
              onClick={markAllRead}
              disabled={!notifications.length || unreadCount === 0}
            >
              <CheckCheck size={15} /> Mark all read
            </button>
            <button
              className="btn btn-primary"
              onClick={openSendModal}
              disabled={!candidates.length}
            >
              <Send size={15} /> Send Notification
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="filter-row" style={{ marginBottom: "18px" }}>
        <button
          className={`filter ${activeTab === "inbox" ? "active" : ""}`}
          onClick={() => setActiveTab("inbox")}
        >
          <Inbox size={15} />
          Inbox {unreadCount > 0 && <span className="badge badge-warning" style={{ padding: "2px 6px", fontSize: "9px" }}>{unreadCount} new</span>}
        </button>
        <button
          className={`filter ${activeTab === "sent" ? "active" : ""}`}
          onClick={() => setActiveTab("sent")}
        >
          <SendHorizontal size={15} />
          Sent to Candidates ({sentNotifications.length})
        </button>
      </div>

      {activeTab === "inbox" ? (
        <div className="card notification-list">
          {notifications.length ? (
            notifications.map(n => {
              const Icon = getIcon(n.type);
              const date = new Date(n.created_at);
              const isUnread = !n.read_at;
              return (
                <div
                  className={`notification-item ${n.type || "info"}`}
                  key={n.id}
                  onClick={() => {
                    if (isUnread) markSingleRead(n.id);
                    if (n.link) navigate(n.link);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <span className="notification-icon">
                    <Icon size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <b>{n.title}</b>
                        <Badge tone={getTone(n.type)}>{n.type === "job_app" || n.type === "job_application" ? "Application" : (n.type || "Info")}</Badge>
                      </div>
                      {isUnread && (
                        <span
                          title="Unread"
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#A92D34",
                            display: "inline-block",
                            boxShadow: "0 0 6px rgba(169, 45, 52, 0.6)"
                          }}
                        />
                      )}
                    </div>
                    <p style={{ margin: "6px 0", color: "var(--ink)", lineHeight: 1.45 }}>{n.message}</p>

                    {/* Direct actionable link if available */}
                    {n.link && (
                      <div style={{ marginTop: "10px", marginBottom: "4px" }}>
                        <Link
                          to={n.link}
                          className="btn btn-primary"
                          onClick={e => {
                            e.stopPropagation();
                            if (isUnread) markSingleRead(n.id);
                          }}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "12px",
                            padding: "6px 14px",
                            fontWeight: "700"
                          }}
                        >
                          {n.type === "job_app" || n.type === "job_application" ? (
                            <><CalendarDays size={13} /> Schedule Interview <ArrowRight size={13} /></>
                          ) : n.link.includes("interview") || n.type === "interview" ? (
                            <><CalendarDays size={13} /> View Interview <ArrowRight size={13} /></>
                          ) : (
                            <><ArrowRight size={13} /> View Details</>
                          )}
                        </Link>
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", fontSize: "10px", color: "var(--muted)" }}>
                      <span><Clock size={12} style={{ verticalAlign: "middle", marginRight: "3px" }} />{date.toLocaleString()}</span>
                      {isUnread && <span style={{ color: "var(--maroon)", fontWeight: 700 }}>• Click to open & mark as read</span>}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="notification-empty" style={{ padding: "40px 20px", textAlign: "center" }}>
              <CheckCircle2 size={32} style={{ color: "var(--success)", marginBottom: "8px" }} />
              <b style={{ display: "block", fontSize: "16px", marginBottom: "4px" }}>All caught up</b>
              <p style={{ color: "var(--muted)", fontSize: "12px" }}>No notifications in your company inbox.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card notification-list">
          {sentNotifications.length ? (
            sentNotifications.map(item => {
              const Icon = getIcon(item.type);
              const date = new Date(item.created_at);
              const recipientName = item.recipient?.full_name || "Candidate";
              return (
                <div className={`notification-item ${item.type || "info"}`} key={item.id}>
                  <span className="notification-icon">
                    <Icon size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <b>{item.title}</b>
                        <Badge tone="info">To: {recipientName}</Badge>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: "9px" }}>Sent</span>
                    </div>
                    <p style={{ margin: "6px 0", color: "var(--ink)", lineHeight: 1.45 }}>{item.message}</p>
                    <small style={{ color: "var(--muted)" }}>
                      Sent on {date.toLocaleString()} {item.recipient?.email ? `• (${item.recipient.email})` : ""}
                    </small>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="notification-empty" style={{ padding: "40px 20px", textAlign: "center" }}>
              <Send size={32} style={{ color: "var(--muted)", marginBottom: "8px" }} />
              <b style={{ display: "block", fontSize: "16px", marginBottom: "4px" }}>No sent notifications</b>
              <p style={{ color: "var(--muted)", fontSize: "12px" }}>You have not sent any notifications to candidates yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Send Notification Modal */}
      <Modal open={sendOpen} title="Send Notification to Candidate" onClose={() => setSendOpen(false)}>
        <form className="form-grid" onSubmit={handleSend}>
          <label>
            Candidate recipient
            <select
              value={form.candidate_id}
              onChange={e => setForm({ ...form, candidate_id: e.target.value })}
              required
            >
              {candidates.map(candidate => (
                <option value={candidate.id} key={candidate.id}>
                  {candidate.full_name || "Unnamed"} ({candidate.email})
                </option>
              ))}
            </select>
          </label>
          <label>
            Notification Type
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              <option value="info">General Update (Info)</option>
              <option value="success">Congratulations / Next Steps (Success)</option>
              <option value="warning">Important Action Required (Warning)</option>
              <option value="interview_scheduled">Interview Reminder</option>
            </select>
          </label>
          <label className="span-2">
            Notification Title
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Next steps for your Frontend Developer interview"
              required
            />
          </label>
          <label className="span-2">
            Message
            <textarea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="Write the message that will be immediately delivered to the candidate's notifications tab."
              rows={4}
              required
            />
          </label>
          <button className="btn btn-primary span-2" type="submit" disabled={sending}>
            <Send size={15} /> {sending ? "Sending..." : "Send Notification"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
