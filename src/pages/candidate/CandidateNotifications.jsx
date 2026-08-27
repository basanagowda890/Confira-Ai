import { useEffect, useState, useCallback } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Send,
  Mail,
  Clock,
  Building2,
  CheckCheck,
  User,
  Inbox,
  SendHorizontal
} from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Modal from "../../components/Modal";
import Toast from "../../components/Toast";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function CandidateNotifications() {
  const [activeTab, setActiveTab] = useState("inbox"); // 'inbox' | 'sent'
  const [inboxItems, setInboxItems] = useState([]);
  const [sentItems, setSentItems] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    interviewer_id: "",
    title: "",
    message: "",
    type: "info",
  });

  const loadData = useCallback(() => {
    Promise.all([
      api.get("/notifications"),
      api.get("/notifications/sent").catch(() => ({ data: [] })),
      api.get("/profiles/interviewers").catch(() => ({ data: [] })),
    ])
      .then(([notifRes, sentRes, interviewerRes]) => {
        setInboxItems(notifRes.data || []);
        setSentItems(sentRes.data || []);
        setInterviewers(interviewerRes.data || []);
      })
      .catch(err => {
        setToast(err.message || "Failed to load notifications.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
    const unsub = subscribeToTable("notifications", null, loadData);
    return () => unsub();
  }, [loadData]);

  function openSendModal() {
    setForm({
      interviewer_id: interviewers[0]?.id || "",
      title: "",
      message: "",
      type: "info",
    });
    setSendOpen(true);
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!form.interviewer_id || !form.title.trim() || !form.message.trim()) {
      setToast("Please select an interviewer, title, and write a message.");
      return;
    }
    setSending(true);
    try {
      await api.post("/notifications", {
        recipient_id: form.interviewer_id,
        interviewer_id: form.interviewer_id,
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
      });
      setSendOpen(false);
      setToast("Notification sent to interviewer successfully!");
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
    setTimeout(() => setToast(""), 2500);
  }

  async function markSingleRead(id) {
    try {
      await api.post(`/notifications/${id}/read`);
      await loadData();
    } catch {
      // quiet fail
    }
  }

  const getIcon = type => {
    switch (type) {
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

  const unreadCount = inboxItems.filter(n => !n.read_at).length;

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="NOTIFICATIONS"
        title="Candidate Notifications"
        description="View interview updates from companies and send direct notifications or responses back to interviewers."
        action={
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              className="btn btn-outline"
              onClick={markAllRead}
              disabled={!inboxItems.length || unreadCount === 0}
            >
              <CheckCheck size={15} /> Mark all read
            </button>
            <button
              className="btn btn-primary"
              onClick={openSendModal}
              disabled={!interviewers.length}
              title={interviewers.length ? "Send notification to interviewer" : "No interviewers available"}
            >
              <Send size={15} /> Send to Interviewer
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
          Sent ({sentItems.length})
        </button>
      </div>

      {activeTab === "inbox" ? (
        <div className="card notification-list">
          {inboxItems.length ? (
            inboxItems.map(n => {
              const Icon = getIcon(n.type);
              const date = new Date(n.created_at);
              const isUnread = !n.read_at;
              return (
                <div
                  className={`notification-item ${n.type || "info"}`}
                  key={n.id}
                  onClick={() => isUnread && markSingleRead(n.id)}
                  style={{ cursor: isUnread ? "pointer" : "default" }}
                >
                  <span className="notification-icon">
                    <Icon size={18} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <b>{n.title}</b>
                        <Badge tone={getTone(n.type)}>{n.type || "Update"}</Badge>
                      </div>
                      {isUnread && (
                        <span
                          title="Unread notification"
                          style={{
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            background: "#A92D34",
                            display: "inline-block",
                            boxShadow: "0 0 6px rgba(169, 45, 52, 0.6)"
                          }}
                        />
                      )}
                    </div>
                    <p style={{ margin: "6px 0", color: "var(--ink)", lineHeight: 1.45 }}>{n.message}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px", fontSize: "10px", color: "var(--muted)" }}>
                      <span><Clock size={12} style={{ verticalAlign: "middle", marginRight: "3px" }} />{date.toLocaleString()}</span>
                      {isUnread && <span style={{ color: "var(--maroon)", fontWeight: 700 }}>• Click to mark as read</span>}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="notification-empty" style={{ padding: "40px 20px", textAlign: "center" }}>
              <CheckCircle2 size={32} style={{ color: "var(--success)", marginBottom: "8px" }} />
              <b style={{ display: "block", fontSize: "16px", marginBottom: "4px" }}>All caught up!</b>
              <p style={{ color: "var(--muted)", fontSize: "12px" }}>No incoming notifications in your candidate inbox.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card notification-list">
          {sentItems.length ? (
            sentItems.map(item => {
              const Icon = getIcon(item.type);
              const date = new Date(item.created_at);
              const recipientName = item.recipient?.company || item.recipient?.full_name || "Interviewer";
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
              <p style={{ color: "var(--muted)", fontSize: "12px" }}>You haven't sent any messages or notifications to interviewers yet.</p>
            </div>
          )}
        </div>
      )}

      {/* Send Notification Modal */}
      <Modal open={sendOpen} title="Send Notification to Interviewer" onClose={() => setSendOpen(false)}>
        <form className="form-grid" onSubmit={handleSend}>
          <label className="span-2">
            Select Interviewer / Company
            <select
              value={form.interviewer_id}
              onChange={e => setForm({ ...form, interviewer_id: e.target.value })}
              required
            >
              {interviewers.map(interviewer => (
                <option value={interviewer.id} key={interviewer.id}>
                  {interviewer.full_name || "Interviewer"} {interviewer.company ? `(${interviewer.company})` : `(${interviewer.email})`}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Notification Category
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              <option value="info">General Query / Communication</option>
              <option value="interview_scheduled">Interview Availability / Confirmation</option>
              <option value="warning">Urgent Note / Reschedule Request</option>
              <option value="success">Follow-up / Thank You</option>
            </select>
          </label>
          <label className="span-2">
            Notification Title
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Question regarding technical round / Availability update"
              required
            />
          </label>
          <label className="span-2">
            Message
            <textarea
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="Write your note or query for the interviewer. It will be delivered directly to their inbox."
              rows={4}
              required
            />
          </label>
          <button className="btn btn-primary span-2" type="submit" disabled={sending}>
            <Send size={15} /> {sending ? "Sending notification..." : "Send Notification to Interviewer"}
          </button>
        </form>
      </Modal>
    </div>
  );
}