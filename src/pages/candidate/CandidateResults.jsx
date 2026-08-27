import { Download, Sparkles, TrendingUp, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import ProgressBar from "../../components/ProgressBar";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";

export default function CandidateResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interviewTitle, setInterviewTitle] = useState("");

  const queryParams = new URLSearchParams(location.search);
  const interviewId = queryParams.get("interview");

  useEffect(() => {
    setLoading(true);
    if (interviewId) {
      api.get(`/results/${interviewId}`)
        .then(response => {
          setResult(response.data);
          return api.get(`/interviews/${interviewId}`).then(iRes => {
            setInterviewTitle(iRes.data?.title || "Completed Interview");
          }).catch(() => {});
        })
        .catch(() => setResult(null))
        .finally(() => setLoading(false));
    } else {
      api.get("/interviews")
        .then(({ data }) => {
          const completed = (data || []).find(interview => interview.status === "completed" && interview.interview_results?.length);
          if (completed) {
            setInterviewTitle(completed.title || "Completed Interview");
            return api.get(`/results/${completed.id}`).then(response => setResult(response.data));
          }
          setResult(null);
        })
        .catch(() => setResult(null))
        .finally(() => setLoading(false));
    }
  }, [interviewId]);

  function downloadResults() {
    if (!result) return;
    const content = [
      `Confira AI Interview Evaluation Results`,
      `========================================`,
      `Interview: ${interviewTitle || "Completed Session"}`,
      `Overall Score: ${result.overall_score ?? "N/A"}/100`,
      ``,
      `Category Breakdown:`,
      `- Technical Skills: ${result.technical_score ?? "N/A"}/100`,
      `- Communication: ${result.communication_score ?? "N/A"}/100`,
      `- Problem Solving: ${result.problem_solving_score ?? "N/A"}/100`,
      `- Confidence: ${result.confidence_score ?? "N/A"}/100`,
      `- Behavioral: ${result.behavioral_score ?? "N/A"}/100`,
      ``,
      `Summary:`,
      `${result.summary || "No summary provided."}`,
      ``,
      `Key Strengths:`,
      `${result.strengths || "None noted."}`,
      ``,
      `Areas for Improvement:`,
      `${result.weaknesses || "None noted."}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `confira-interview-results-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const metrics = result ? [
    ["Technical skills", result.technical_score],
    ["Communication", result.communication_score],
    ["Problem solving", result.problem_solving_score],
    ["Confidence", result.confidence_score],
    ["Behavioral", result.behavioral_score],
  ] : [];

  return (
    <div>
      <SectionTitle
        eyebrow="RESULTS & EVALUATION"
        title={interviewTitle ? `${interviewTitle} — Performance Feedback` : "Interview Feedback"}
        description="Review performance metrics, AI-assisted evaluation signals, and interviewer feedback."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline" onClick={() => navigate("/candidate/interviews")}>
              <ArrowLeft size={16} /> Back to Interviews
            </button>
            {result && (
              <button className="btn btn-primary" onClick={downloadResults}>
                <Download size={16} /> Download Summary
              </button>
            )}
          </div>
        }
      />

      {loading ? (
        <p className="empty-state">Loading interview evaluation results...</p>
      ) : result ? (
        <>
          <div className="score-hero card" style={{ marginBottom: "20px" }}>
            <div className="score-circle">
              <b>{result.overall_score ?? "-"}</b>
              <span>/100</span>
            </div>
            <div>
              <Badge tone={(result.overall_score || 0) >= 70 ? "success" : "warning"}>
                {(result.overall_score || 0) >= 70 ? "Strong Performance" : "Under Review"}
              </Badge>
              <h2 style={{ marginTop: "8px" }}>Evaluation Overview</h2>
              <p>{result.summary || "Your interviewer has submitted evaluation feedback for this completed session."}</p>
            </div>
          </div>

          <div className="analysis-grid">
            {metrics.map(([label, value]) => (
              <div className="card" key={label}>
                <ProgressBar value={value || 0} label={label} />
                <p className="muted" style={{ marginTop: "8px" }}>Based on your completed session</p>
              </div>
            ))}
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <h3>Interviewer Feedback & Notes</h3>
                <p>Constructive evaluation breakdown</p>
              </div>
              <Sparkles size={20} />
            </div>
            <div className="feedback-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--cream)" }}>
                <TrendingUp size={17} style={{ color: "var(--success)", marginRight: "6px" }} />
                <b>Strengths:</b> {result.strengths || "Solid demonstration of domain concepts."}
              </div>
              <div style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--cream)" }}>
                <TrendingUp size={17} style={{ color: "var(--warning)", marginRight: "6px" }} />
                <b>Areas to improve:</b> {result.weaknesses || "Continue refining structured problem walkthroughs."}
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="empty-state">
          <h3>Results are not available yet</h3>
          <p style={{ marginTop: "6px" }}>The feedback for this interview has not been submitted or published by the interviewer yet.</p>
        </div>
      )}
    </div>
  );
}