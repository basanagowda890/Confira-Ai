import { Download, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import ProgressBar from "../../components/ProgressBar";
import { api } from "../../lib/api";

function downloadResults() {
  const blob = new Blob(["Confira AI interview results\nOverall score: 85/100\nTechnical skills: 88\nCommunication: 82"], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "confira-interview-results.txt";
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function CandidateResults() {
  const [result, setResult] = useState(null);
  useEffect(() => { api.get("/interviews").then(({ data }) => { const completed = (data || []).find(interview => interview.status === "completed"); if (completed) return api.get(`/results/${completed.id}`).then(response => setResult(response.data)); }).catch(() => {}); }, []);
  const metrics = result ? [["Technical skills", result.technical_score], ["Communication", result.communication_score], ["Problem solving", result.problem_solving_score], ["Confidence", result.confidence_score], ["Behavioral", result.behavioral_score]] : [];
  return <div>
    <SectionTitle eyebrow="RESULTS" title="Interview feedback" description="Your latest interview performance and improvement areas." action={<button className="btn btn-outline" onClick={downloadResults}><Download size={16} /> Download</button>} />
    {result ? <div className="score-hero card"><div className="score-circle"><b>{result.overall_score ?? "-"}</b><span>/100</span></div><div><BadgeText /><h2>Interview feedback</h2><p>{result.summary || "Your interviewer has shared feedback for this interview."}</p></div></div> : <p className="empty-state">No interview results are available yet.</p>}
    <div className="analysis-grid">
      {metrics.map(([label, value]) => <div className="card" key={label}><ProgressBar value={value || 0} label={label} /><p className="muted">Based on your completed interview</p></div>)}
    </div>
    <section className="card"><div className="card-head"><div><h3>Feedback</h3><p>Shared interviewer evaluation</p></div><Sparkles size={20} /></div>{result ? <div className="feedback-list"><div><TrendingUp size={17}/><b>Strengths:</b> {result.strengths || "No strengths added yet."}</div><div><TrendingUp size={17}/><b>Areas to improve:</b> {result.weaknesses || "No improvement areas added yet."}</div></div> : <p className="empty-state">Feedback will appear after your interview is evaluated.</p>}</section>
  </div>;
}
function BadgeText(){ return <span className="badge badge-success">Good fit signal</span>; }