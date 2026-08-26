import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Logo from "../components/Logo";
import { useAuth } from "../context/AuthContext";

export default function CandidateLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isLive = location.pathname.endsWith("/live");
  const { profile, avatarUrl } = useAuth();
  const name = profile?.full_name || "Candidate";

  return (
    <div className="app-shell">
      <Sidebar role="candidate" />
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><Logo /></div>
          <div className="topbar-spacer" />
          <button className="icon-btn" aria-label="Open notifications" title="Notifications" onClick={() => navigate("/candidate/notifications")}><Bell size={18} /><span className="notification-dot" /></button>
          <button className="profile-chip" aria-label="Open candidate profile" onClick={() => navigate("/candidate/profile")}>
            <span className="avatar">{avatarUrl ? <img src={avatarUrl} alt="" /> : name.slice(0, 2).toUpperCase()}</span>
            <span><b>{name}</b><small>Candidate</small></span>
            <ChevronDown size={15} />
          </button>
        </header>
        <div className={isLive ? "page page-live" : "page"}><Outlet /></div>
      </main>
    </div>
  );
}
