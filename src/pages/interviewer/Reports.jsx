import { Download, FileText, Share2 } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import ProgressBar from "../../components/ProgressBar";
import Badge from "../../components/Badge";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function Reports() {
  const [interviews, setInterviews] = useState([]); const [selectedId, setSelectedId] = useState(""); const [report, setReport] = useState(null);
  useEffect(() => { api.get("/interviews").then(({ data }) => { const list = data || []; setInterviews(list); setSelectedId(list[0]?.id || ""); if (list[0]) api.get(`/reports/${list[0].id}`).then(response => setReport(response.data)).catch(() => {}); }).catch(() => {}); }, []);
  async function selectInterview(id) { setSelectedId(id); try { const response = await api.get(`/reports/${id}`); setReport(response.data); } catch { setReport(null); } }
  const interview = interviews.find(item => item.id === selectedId); const scores = report?.content?.scores || {};
  return <div><SectionTitle eyebrow="REPORTS" title={`${interview?.profiles?.full_name || "Candidate"} — Interview report`} description={interview ? `${interview.profiles?.full_name || "Candidate"} · ${interview.title}` : "Reports generated from completed interviews."} action={<div className="btn-group"><button className="btn btn-outline" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Share2 size={15}/> Share</button><button className="btn btn-primary" onClick={() => window.print()}><Download size={15}/> Download report</button></div>} />
    <div className="candidate-picker card"><div><h3>View candidate report</h3><p>Review reports generated from shared interview records.</p></div><select value={selectedId} onChange={event => selectInterview(event.target.value)}>{interviews.map(item => <option value={item.id} key={item.id}>{item.profiles?.full_name || "Candidate"} · {item.title}</option>)}</select></div>
    {report ? <><div className="report-header card"><div className="report-score"><span>Overall score</span><b>{scores.overall_score ?? "—"}</b><Badge tone="info">{interview?.status}</Badge></div><div className="report-summary"><h3>Summary</h3><p>{scores.summary || "No summary was added to this report."}</p></div></div><div className="report-grid"><section className="card"><div className="card-head"><h3>Detailed breakdown</h3><FileText size={18}/></div>{[["Technical round",scores.technical_score],["Communication",scores.communication_score],["Problem solving",scores.problem_solving_score],["Confidence",scores.confidence_score],["Behavioral",scores.behavioral_score]].map(([label,value])=><ProgressBar key={label} label={label} value={value || 0}/>)}</section><section className="card"><div className="card-head"><h3>Integrity & monitoring</h3><Badge tone="info">Database events</Badge></div><p>{report.content?.monitoring_summary?.length || 0} monitoring events recorded for this interview.</p></section></div></> : <p className="empty-state">No report is available for this interview yet.</p>}
  </div>;
}