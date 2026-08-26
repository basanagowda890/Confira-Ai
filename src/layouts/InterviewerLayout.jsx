import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function InterviewerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLive = location.pathname.endsWith("/live");
  const { profile } = useAuth();
  const name = profile?.company || profile?.full_name || "Interviewer";

  return (
    <div className="app-shell">
      <Sidebar role="interviewer" />
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><Logo /></div>
          <div className="topbar-spacer" />
          <button className="icon-btn" aria-label="Open notifications" title="Notifications" onClick={() => navigate("/interviewer/notifications")}><Bell size={18} /><span className="notification-dot" /></button>
          <button className="profile-chip" aria-label="Open company settings" onClick={() => navigate("/interviewer/settings")}>
            <span className="avatar company-avatar">{name.slice(0, 2).toUpperCase()}</span>
            <span><b>{name}</b><small>Interviewer</small></span>
            <ChevronDown size={15} />
          </button>
        </header>
        <div className={isLive ? "page page-live" : "page"}><Outlet /></div>
      </main>
    </div>
  );
}
