import { useState } from "react";
import { Camera, CheckCircle2, Mic2, MonitorUp, Wifi, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";

const checks = [
  ["Camera", Camera, "Camera permission", true],
  ["Microphone", Mic2, "Microphone input", true],
  ["Screen share", MonitorUp, "Screen sharing permission", true],
  ["Connection", Wifi, "Stable network", true],
  ["Browser", ShieldCheck, "Supported browser", true]
];

export default function SystemCheck() {
  const [running, setRunning] = useState(false);
  return <div>
    <SectionTitle eyebrow="SYSTEM CHECK" title="Make sure everything works" description="Run a quick pre-interview test before joining." />
    <section className="card system-card">
      <div className="system-grid">
        {checks.map(([name, Icon, text, ok]) => <div className="system-check" key={name}><div className="system-icon"><Icon size={20} /></div><div><b>{name}</b><p>{text}</p></div><span className={running ? "check-spin" : ""}>{running ? "..." : ok ? <CheckCircle2 size={19} /> : "—"}</span></div>)}
      </div>
      <div className="system-video"><div className="fake-camera"><div className="camera-person">BG</div><span>Camera preview</span></div><div className="system-controls"><button className="btn btn-outline" onClick={() => setRunning(true)}>Test again</button><Link className="btn btn-primary" to="/candidate/live">Enter interview <ArrowRight size={16} /></Link></div></div>
    </section>
  </div>;
}