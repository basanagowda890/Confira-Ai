import { CheckCircle2, Flag, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";

export default function Recommendation() {
  const [choice,setChoice]=useState("recommended"); const [candidates, setCandidates] = useState([]);
  useEffect(() => { api.get("/profiles/candidates").then(result => setCandidates(result.data || [])).catch(() => {}); }, []);
  const candidate = candidates[0] || { full_name: "No candidate selected", headline: "" };
  return <div><SectionTitle eyebrow="HIRING DECISION" title="Final recommendation" description={`Human decision workspace for ${candidate.full_name} — ${candidate.headline || "Candidate"}.`} />
    <div className="recommend-grid"><section className="card decision-card"><div className="candidate-summary"><span className="avatar avatar-lg">{(candidate.full_name || "C").slice(0, 2).toUpperCase()}</span><div><h2>{candidate.full_name}</h2><p>{candidate.headline || "Candidate"}</p><Badge tone="info">Human review required</Badge></div></div><h3>Choose a recommendation</h3><div className="decision-options">{[["recommended","Recommend",ThumbsUp,"Move to the next stage."],["review","Review",Flag,"Need additional interviewer review."],["reject","Do not recommend",ThumbsDown,"Do not proceed with this candidate."]].map(([id,title,Icon,text])=><button key={id} className={choice===id?"selected":""} onClick={()=>setChoice(id)}><Icon size={20}/><div><b>{title}</b><span>{text}</span></div>{choice===id&&<CheckCircle2 size={18}/>}</button>)}</div><label>Decision notes<textarea placeholder="Add evidence, concerns or context for the hiring team." /></label><button className="btn btn-primary btn-lg" disabled={!candidates.length}><ShieldCheck size={17}/> Save recommendation</button></section><aside className="card"><div className="card-head"><h3>Decision checklist</h3></div>{["Review full transcript","Review integrity alerts","Check resume against role","Consider interviewer notes","Avoid automated rejection based on a single signal"].map(x=><div className="check-row" key={x}><CheckCircle2 size={17}/><span>{x}</span></div>)}</aside></div>
  </div>;
}