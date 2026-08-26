import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, BriefcaseBusiness, Users, CalendarDays, Radio, BrainCircuit, GitCompareArrows, FileText, ShieldCheck, MessagesSquare, Settings, LogOut, UserRound, ClipboardCheck, MonitorCheck, Mic2, BookOpen, Bell, Sparkles } from "lucide-react";
import Logo from "./Logo";
import { useAuth } from "../context/AuthContext";

const candidateItems = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["profile", "Profile & Resume", UserRound],
  ["jobs", "Jobs", BriefcaseBusiness],
  ["interviews", "My Interviews", CalendarDays],
  ["practice", "Practice Tests", ClipboardCheck],
  ["resources", "Resources", BookOpen],
  ["notifications", "Notifications", Bell],
  ["settings", "Settings", Settings],
];

const interviewerItems = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["jobs", "Jobs & Positions", BriefcaseBusiness],
  ["candidates", "Candidates", Users],
  ["interviews", "Interviews", CalendarDays],
  ["live", "Live Monitoring", Radio],
  ["analysis", "AI Analysis", BrainCircuit],
  ["comparison", "Compare Candidates", GitCompareArrows],
  ["reports", "Reports", FileText],
  ["recommendation", "Hiring Recommendation", ShieldCheck],
  ["group-discussion", "Group Discussion", MessagesSquare],
  ["notifications", "Notifications", Bell],
];

export default function Sidebar({ role = "candidate" }) {
  const navigate = useNavigate();
  const items = role === "candidate" ? candidateItems : interviewerItems;
  const { logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <Logo dark />
        <span className="role-pill">{role === "candidate" ? "Candidate" : "Company"}</span>
      </div>

      <nav className="nav-list">
        {items.map(([path, label, Icon]) => (
          <NavLink key={path} to={`/${role === "candidate" ? "candidate" : "interviewer"}/${path}`} className="nav-item">
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {role === "candidate" && (
          <button className="nav-item" onClick={() => navigate("/candidate/system-check")}><MonitorCheck size={18} />System Check</button>
        )}
        {role === "interviewer" && (
          <button className="nav-item" onClick={() => navigate("/interviewer/settings")}><Settings size={18} />Settings</button>
        )}
        <button className="nav-item" onClick={async () => { await logout(); navigate("/"); }}><LogOut size={18} />Logout</button>
      </div>
    </aside>
  );
}
