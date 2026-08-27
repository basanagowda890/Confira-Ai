import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { subscribeToTable } from "../lib/realtime";

export default function CandidateLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLive = location.pathname.endsWith("/live");
  const { profile, avatarUrl } = useAuth();
  const name = profile?.full_name || "Candidate";
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = () => {
      api.get("/notifications")
        .then(res => {
          const unread = (res.data || []).filter(n => !n.read_at).length;
          setUnreadCount(unread);
        })
        .catch(() => setUnreadCount(0));
    };
    fetchUnread();
    return subscribeToTable("notifications", null, fetchUnread);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar role="candidate" unreadCount={unreadCount} />
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><Logo /></div>
          <div className="topbar-spacer" />
          <ThemeToggle variant="topbar" />
          <button
            className="icon-btn"
            aria-label="Open notifications"
            title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
            onClick={() => navigate("/candidate/notifications")}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notification-badge" aria-label={`${unreadCount} unread notifications`}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
          <button className="profile-chip" aria-label="Open candidate profile" onClick={() => navigate("/candidate/profile")}>
            <span className="avatar" style={{ overflow: "hidden" }}>
              <img
                src={avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </span>
            <span><b>{name}</b><small>Candidate</small></span>
            <ChevronDown size={15} />
          </button>
        </header>
        <div className={isLive ? "page page-live" : "page"}><Outlet /></div>
      </main>
    </div>
  );
}
