import { BrainCircuit, CheckCircle2, Eye, Mic2, Smile, Volume2, Search } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import ProgressBar from "../../components/ProgressBar";
import Badge from "../../components/Badge";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function AIAnalysis() {
  const [selectedId, setSelectedId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState("");
  useEffect(() => { api.get("/profiles/candidates").then(result => { const list = result.data || []; setCandidates(list); setSelectedId(list[0]?.id || ""); }).catch(() => setCandidates([])); }, []);
  const candidate = candidates.find(item => item.id === selectedId) || { full_name: "No candidate", headline: "", id: "" };
  const filteredCandidates = candidates.filter(item => `${item.full_name} ${item.headline || ""}`.toLowerCase().includes(search.toLowerCase()));
  const score = 0;
  const metrics=[["Answer quality",score],["Technical relevance",score],["Grammar",score],["Voice quality",score],["Pronunciation",score],["Eye contact",score],["Face visibility",score],["Head stability",score]];
  return <div><SectionTitle eyebrow="AI ANALYSIS" title={`${candidate.full_name} — Interview insights`} description="A structured view of model outputs. Signals should support human review, not replace it." action={<Badge tone="neutral">Awaiting interview result</Badge>} />
    <div className="candidate-picker card"><div><h3>Analyze candidate</h3><p>Select a registered candidate to inspect available signals.</p></div><div className="candidate-picker-controls"><div className="search-box"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search candidates..." aria-label="Search candidates" /></div><select value={selectedId} onChange={event => setSelectedId(event.target.value)}>{filteredCandidates.map(item => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select></div></div>
    <div className="analysis-hero card"><div className="score-circle"><b>—</b><span>/100</span></div><div><h2>Overall interview score</h2><p>Scores appear after an interviewer evaluates a completed interview.</p></div></div>
    <div className="analysis-grid">{metrics.map(([label,value])=><div className="card" key={label}><ProgressBar value={value} label={label}/><p className="muted">Model confidence is shown with each metric in the production backend.</p></div>)}</div>
    <div className="dashboard-grid"><section className="card"><div className="card-head"><h3>Facial & behavioral signals</h3><Eye size={19}/></div><div className="signal-grid">{[["Expression","Happy","82%"],["Authenticity signal","Genuine-like","78%"],["Eye contact","Focused","82%"],["Head movement","Normal","76%"]].map(x=><div key={x[0]}><small>{x[0]}</small><b>{x[1]}</b><span>{x[2]} confidence</span></div>)}</div></section><section className="card"><div className="card-head"><h3>Voice & speech</h3><Mic2 size={19}/></div><div className="signal-grid">{[["Voice quality","Clear","87%"],["Pronunciation","Good","90%"],["Grammar","Strong","94%"],["Pace","Balanced","84%"]].map(x=><div key={x[0]}><small>{x[0]}</small><b>{x[1]}</b><span>{x[2]} confidence</span></div>)}</div></section></div>
  </div>;
}