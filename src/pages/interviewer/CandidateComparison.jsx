import { ArrowDownUp, CheckCircle2, Download, Star, Trophy } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

export default function CandidateComparison() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/interviews").then(async ({ data }) => { const interview = (data || [])[0]; if (!interview) return; const result = await api.get(`/interviews/${interview.id}/candidate-comparison`); setList(result.data || []); }).catch(() => setList([])); }, []);
  const criteria = [["Technical skills", "technical_score"], ["Communication", "communication_score"], ["Problem solving", "problem_solving_score"], ["Confidence", "confidence_score"], ["Overall score", "overall_score"]];
  return <div><SectionTitle eyebrow="COMPARISON" title="Compare candidates" description="Use consistent criteria to support a hiring decision." action={<button className="btn btn-outline" onClick={() => window.print()}><Download size={16}/> Export comparison</button>} />
    <div className="comparison-top">{list.map((result,i)=>{const candidate=result.profiles || {}; return <div className={`card compare-card ${i===0?"winner":""}`} key={result.id}>{i===0&&<span className="winner-label"><Trophy size={14}/> Top score</span>}<span className="avatar avatar-lg">{(candidate.full_name || "C").slice(0, 2).toUpperCase()}</span><h3>{candidate.full_name || "Candidate"}</h3><p>{candidate.headline || "Candidate"}</p><div className="big-score">{result.overall_score ?? "—"}</div><Badge tone="info">Interview result</Badge></div>})}</div>
    <section className="card"><div className="card-head"><div><h3>Criteria comparison</h3><p>Scores from shared interview results</p></div><ArrowDownUp size={18}/></div><div className="table-wrap"><table><thead><tr><th>Criteria</th>{list.map(result=><th key={result.id}>{result.profiles?.full_name || "Candidate"}</th>)}</tr></thead><tbody>{criteria.map(([label,field])=><tr key={label}><td><b>{label}</b></td>{list.map(result=><td key={result.id}><strong>{result[field] ?? "—"}</strong>{result[field] >= 90&&<CheckCircle2 size={14} className="table-good"/>}</td>)}</tr>)}</tbody></table></div>{!list.length&&<p className="empty-state">No completed interview results are available for comparison.</p>}</section>
  </div>;
}