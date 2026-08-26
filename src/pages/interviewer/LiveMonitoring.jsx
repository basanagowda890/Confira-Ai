import { useEffect, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Clock3, Eye, Headphones, MonitorUp, MousePointer2, Mic2, Radio, ShieldAlert, Users, Volume2, XCircle, Keyboard, Globe2, AppWindow, Play, Search } from "lucide-react";
import { Link } from "react-router-dom";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import { api } from "../../lib/api";

export default function LiveMonitoring() {
  const [tab, setTab] = useState("overview");
  const [ended, setEnded] = useState(false);
  const [screenView, setScreenView] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [seconds, setSeconds] = useState(1548);
  useEffect(() => { const id = setInterval(() => setSeconds(s => s + 1), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { api.get("/profiles/candidates").then(result => { const list = result.data || []; setCandidates(list); setSelectedId(list[0]?.id || ""); }).catch(() => setCandidates([])); }, []);
  const time = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
  const selectedCandidate = candidates.find(candidate => candidate.id === selectedId) || { full_name: "No candidate", headline: "", id: "" };
  const filteredCandidates = candidates.filter(candidate => `${candidate.full_name} ${candidate.headline || ""}`.toLowerCase().includes(search.toLowerCase()));
  const metrics = [["Answer quality", 0, CheckCircle2], ["Relevance", 0, CheckCircle2], ["Voice quality", 0, Volume2], ["Eye contact", 0, Eye], ["Face visibility", 0, Camera], ["Pronunciation", 0, Mic2]];
  return <div className="monitor-page">
    <div className="monitor-head">
      <div><div className="eyebrow">LIVE INTERVIEW</div><h1>{selectedCandidate.full_name} <Badge tone="danger"><span className="live-dot"/> LIVE</Badge></h1><p>{selectedCandidate.headline || "Interview"} · Technical Round · <Clock3 size={14}/> {time}</p></div>
      <div className="monitor-actions"><button className="btn btn-outline" onClick={() => setScreenView(value => !value)} aria-pressed={screenView}><MonitorUp size={16}/> {screenView ? "Return to overview" : "Screen view"}</button><button className="btn btn-danger" onClick={() => setEnded(true)} disabled={ended}>{ended ? "Interview ended" : "End interview"}</button></div>
    </div>
    <div className="monitor-tabs">
      <button className={tab==="overview"?"active":""} onClick={()=>setTab("overview")}>Live overview</button>
      <button className={tab==="activity"?"active":""} onClick={()=>setTab("activity")}>Activity timeline</button>
      <button className={tab==="transcript"?"active":""} onClick={()=>setTab("transcript")}>Live transcript</button>
    </div>

    {tab==="overview" && <div className="monitor-layout-v2">
      <section className="monitor-main">
        <div className="card participant-monitor-card"><div className="card-head"><div><h3>Interview participants</h3><p>Select a person to focus their live analysis.</p></div><Badge tone="info">{candidates.length} people</Badge></div><div className="candidate-search search-box"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search candidates..." aria-label="Search candidates" /></div><div className="participant-monitor-grid">{filteredCandidates.map(candidate => <button type="button" className={`participant-monitor ${selectedId === candidate.id ? "active" : ""}`} onClick={() => setSelectedId(candidate.id)} key={candidate.id}><div className="camera-person">{(candidate.full_name || "C").slice(0, 2).toUpperCase()}</div><span>{candidate.full_name}</span><small>Profile available</small><i>Camera ON</i></button>)}</div>{!filteredCandidates.length && <p className="empty-state">No candidates match your search.</p>}</div>
        <div className="video-grid">
          <div className="monitor-video"><div className="camera-person large">{(selectedCandidate.full_name || "C").slice(0, 2).toUpperCase()}</div><span className="video-label">{selectedCandidate.full_name} camera</span><span className="video-badge">Camera ON</span></div>
          <div className="monitor-screen"><div className="fake-code"><div className="code-bar"/>{Array.from({length:12}).map((_,i)=><span key={i} style={{width:`${35+(i*13)%50}%`}}/>)}</div><span className="video-label">Candidate screen</span><span className="video-badge">Sharing ON</span></div>
        </div>
        <div className="ai-metrics">
          {metrics.map(([label,val,Icon]) =>
            <div className="metric-card" key={label}><div><Icon size={17}/><span>{label}</span></div><b>{val}%</b><ProgressBar value={val}/></div>)}
        </div>
        <div className="card"><div className="card-head"><div><h3>Current question</h3><p>Question 6 of 10</p></div><Badge tone="info">Technical</Badge></div>
          <h2 className="question">How would you optimize a React application that is becoming slow as the component tree grows?</h2>
          <div className="transcript"><span>Live answer</span><p>"I would first profile the application to identify expensive renders, then use memoization, code splitting and virtualization where appropriate..."</p></div>
        </div>
      </section>

      <aside className="activity-rail">
        <div className="card candidate-roster"><div className="card-head"><div><h3>Interview candidates</h3><p>Select a person to review their analysis.</p></div><Users size={18}/></div>{filteredCandidates.map(candidate => <button type="button" className={`candidate-select ${selectedId === candidate.id ? "active" : ""}`} onClick={() => setSelectedId(candidate.id)} key={candidate.id}><span className="avatar">{(candidate.full_name || "C").slice(0, 2).toUpperCase()}</span><span><b>{candidate.full_name}</b><small>{candidate.headline || "Candidate"}</small></span><strong>—</strong></button>)}<Link className="btn btn-primary btn-full" to={`/interviewer/live-room?candidate=${selectedCandidate.id}&room=${selectedCandidate.id}`}><Play size={15}/> Start interview with {(selectedCandidate.full_name || "candidate").split(" ")[0]}</Link></div>
        <div className="card activity-card">
          <div className="card-head"><div><h3>{selectedCandidate.full_name} activity</h3><p>Live activity stream</p></div><Badge tone="danger"><span className="live-dot"/> LIVE</Badge></div>
          <div className="activity-summary"><div><b>2</b><span>Alerts</span></div><div><b>1</b><span>Focus loss</span></div><div><b>100%</b><span>Screen active</span></div></div>
          <div className="activity-feed">
            <Activity icon={ShieldAlert} tone="critical" time="10:42:18" title="Tab switch detected" detail="Candidate moved away from the interview tab."/>
            <Activity icon={AlertTriangle} tone="warning" time="10:41:02" title="Face partially visible" detail="Face visibility dropped below the configured threshold."/>
            <Activity icon={Keyboard} tone="info" time="10:40:31" title="Keyboard activity" detail="Typing activity detected while the question was active."/>
            <Activity icon={Globe2} tone="info" time="10:39:50" title="Browser focus changed" detail="Browser focus changed and returned after 1.8 seconds."/>
            <Activity icon={MonitorUp} tone="success" time="10:38:47" title="Screen sharing active" detail="Candidate screen sharing is healthy."/>
            <Activity icon={CheckCircle2} tone="success" time="10:35:11" title="Identity verified" detail="Face match completed successfully."/>
          </div>
        </div>
        <div className="card"><div className="card-head"><h3>Presence checks</h3><Badge tone="success">Normal</Badge></div><div className="presence-list">
          <div><Camera size={16}/> Face detected <CheckCircle2 size={15}/></div><div><Users size={16}/> Single person <CheckCircle2 size={15}/></div>
          <div><Headphones size={16}/> Audio active <CheckCircle2 size={15}/></div><div><MousePointer2 size={16}/> Browser focus <XCircle size={15} className="bad"/></div>
          <div><AppWindow size={16}/> Interview tab <XCircle size={15} className="bad"/></div>
        </div></div>
        <div className="card"><div className="card-head"><h3>Behavior signals</h3><Eye size={18}/></div><ProgressBar value={82} label="Eye contact"/><ProgressBar value={91} label="Face visibility"/><ProgressBar value={76} label="Head stability"/><ProgressBar value={88} label="Voice confidence"/></div>
      </aside>
    </div>}

    {tab==="activity" && <ActivityTimeline/>}
    {tab==="transcript" && <Transcript/>}
  </div>;
}

function Activity({icon:Icon,tone,time,title,detail}){
  return <div className={`activity-event ${tone}`}><span className="activity-event-icon"><Icon size={15}/></span><div className="activity-event-body"><div><b>{title}</b><time>{time}</time></div><p>{detail}</p></div></div>;
}
function ActivityTimeline(){
  const events=[["10:42:18","critical","Tab switch detected","Candidate navigated away from the interview tab."],["10:41:02","warning","Face partially visible","Face visibility dropped below 60% for 2.1 seconds."],["10:40:31","info","Keyboard activity","Typing activity detected while the question was active."],["10:39:21","info","Question submitted","Candidate completed question 5."],["10:38:47","success","Screen sharing active","Candidate screen sharing is healthy."],["10:35:11","success","Identity verified","Face match completed successfully."]];
  return <section className="card timeline-card"><div className="card-head"><div><h3>Activity timeline</h3><p>Every important interview event in chronological order.</p></div><Badge tone="info">Live</Badge></div><div className="timeline">{events.map(e=><div className="timeline-item" key={e[0]}><time>{e[0]}</time><span className={`timeline-dot ${e[1]}`}/><div><b>{e[2]}</b><p>{e[3]}</p></div></div>)}</div></section>;
}
function Transcript(){
  return <section className="card transcript-full"><div className="card-head"><div><h3>Live transcript</h3><p>Speech-to-text stream for interviewer review.</p></div><Badge tone="success">Listening</Badge></div><div className="transcript-lines">
    <div><time>10:42:20</time><b>Candidate</b><p>I would start by profiling the React application...</p></div>
    <div><time>10:42:35</time><b>Candidate</b><p>Then I would reduce unnecessary renders with memoization and component boundaries...</p></div>
    <div><time>10:42:49</time><b>AI note</b><p>Answer relevance: 92%. Strong use of concrete optimization techniques.</p></div>
  </div></section>;
}