import { Check, Camera, Mic2, MonitorUp, Wifi, ShieldCheck, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";

const points = [
  [Camera, "Keep your face visible", "Use a quiet, well-lit place and keep your camera at eye level."],
  [MonitorUp, "Keep screen sharing enabled", "Your screen may be monitored during the interview according to company policy."],
  [Mic2, "Use a clear microphone", "Avoid headphones or environments with heavy background noise when possible."],
  [Wifi, "Use a stable connection", "Close downloads and unnecessary applications before starting."],
  [ShieldCheck, "Follow interview rules", "Do not use unauthorized resources or communicate with another person during the assessment."]
];

export default function InterviewInstructions() {
  return <div>
    <SectionTitle eyebrow="BEFORE YOU BEGIN" title="Interview instructions" description="A quick checklist before your Frontend Developer interview." />
    <div className="two-col">
      <section className="card">
        <div className="instruction-list">{points.map(([Icon, title, text]) => <div className="instruction" key={title}><span><Icon size={19} /></span><div><b>{title}</b><p>{text}</p></div><Check size={17} className="instruction-check" /></div>)}</div>
        <div className="notice"><ShieldCheck size={18} /><div><b>Privacy & monitoring</b><p>Confira records only the events and signals configured for this interview. The company should inform candidates about monitoring before the session.</p></div></div>
        <Link className="btn btn-primary btn-lg" to="/candidate/system-check">Run system check <ArrowRight size={17} /></Link>
      </section>
      <div className="illustration-card"><div className="big-orb"><Camera size={45} /></div><h3>Ready when you are.</h3><p>Complete the system check, then enter the interview room.</p></div>
    </div>
  </div>;
}