import { useEffect, useState } from "react";
import { Camera, Mic2, MonitorUp, PhoneOff, ShieldCheck, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import ChatBox from "../../components/ChatBox";

export default function CandidateLiveInterview() {
  const roomId = new URLSearchParams(window.location.search).get("room") || "demo-room";
  const [seconds, setSeconds] = useState(154);
  const [camera, setCamera] = useState(true);
  const [mic, setMic] = useState(true);
  const [sharing, setSharing] = useState(false);
  useEffect(() => { const id = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(id); }, []);
  const time = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  return <div className="live-candidate">
    <div className="live-head"><div><b>Frontend Developer Interview</b><span>Technical Round · Question 4 of 10</span></div><div className="live-status"><span className="live-dot" /> Live <Clock3 size={15} /> {time}</div></div>
    <div className="live-layout">
      <section className="live-video-panel"><div className={`live-video ${camera ? "" : "video-disabled"}`}><div className="camera-person large">{camera ? "BG" : ""}</div><span className="video-name">{camera ? "Basana Gowda" : "Camera off"}</span><span className="recording">● Recording</span></div><div className="question-card"><span className="eyebrow">CURRENT QUESTION</span><h2>How would you optimize a React application that is becoming slow as the component tree grows?</h2><p>Take your time. Your answer is being transcribed for the interview report.</p></div><div className="live-actions"><button onClick={() => setCamera(value => !value)} aria-pressed={!camera}><Camera size={17} /> Camera</button><button onClick={() => setMic(value => !value)} aria-pressed={!mic}><Mic2 size={17} /> {mic ? "Microphone" : "Muted"}</button><button onClick={() => setSharing(value => !value)} aria-pressed={sharing}><MonitorUp size={17} /> {sharing ? "Stop sharing" : "Screen share"}</button><Link to="/candidate/results" className="end-btn"><PhoneOff size={17} /> End</Link></div></section>
      <aside className="live-side"><div className="card"><div className="card-head"><h3>Interview progress</h3><b>40%</b></div><div className="progress-track"><div className="progress-fill" style={{width:"40%"}} /></div>{["Introduction","JavaScript","React","Problem solving","HR"].map((x,i)=><div className="round-step" key={x}><span className={i<3 ? "done" : ""}>{i<3 ? "✓" : i+1}</span>{x}</div>)}</div><div className="card privacy-card"><ShieldCheck size={20} /><div><b>Integrity monitoring active</b><p>Your camera, microphone and screen status are visible to the interviewer while enabled.</p></div></div><ChatBox roomId={roomId} sender="Candidate" /></aside>
    </div>
  </div>;
}