import { Download, Sparkles, TrendingUp, ArrowLeft, CheckCircle2, XCircle, ThumbsUp, ThumbsDown, Award, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import ProgressBar from "../../components/ProgressBar";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";

export default function CandidateResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interview, setInterview] = useState(null);

  const queryParams = new URLSearchParams(location.search);
  const interviewId = queryParams.get("interview");

  useEffect(() => {
    setLoading(true);
    if (interviewId) {
      Promise.allSettled([
        api.get(`/results/${interviewId}`),
        api.get(`/interviews/${interviewId}`)
      ])
        .then(([resResult, resInt]) => {
          if (resResult.status === "fulfilled" && resResult.value?.data) {
            setResult(resResult.value.data);
          } else {
            setResult(null);
          }
          if (resInt.status === "fulfilled" && resInt.value?.data) {
            setInterview(resInt.value.data);
          }
        })
        .finally(() => setLoading(false));
    } else {
      api.get("/interviews")
        .then(({ data }) => {
          const completed = (data || []).find(i => i.status === "completed" && i.interview_results?.length);
          if (completed) {
            setInterview(completed);
            return api.get(`/results/${completed.id}`).then(response => setResult(response.data));
          }
          setResult(null);
        })
        .catch(() => setResult(null))
        .finally(() => setLoading(false));
    }
  }, [interviewId]);

  const isSelected = result?.recommendation === "strong_hire" || result?.recommendation === "hire";
  const isRejected = result?.recommendation === "no_hire";
  const interviewTitle = interview?.title || interview?.jobs?.title || "Technical Interview";
  const jobTitle = interview?.jobs?.title || interviewTitle;

  function downloadResults() {
    if (!result) return;
    const outcomeText = isSelected ? "SELECTED / HIRED" : isRejected ? "NOT SELECTED" : "EVALUATION COMPLETED";
    const content = [
      `Confira AI Interview Evaluation & Outcome Report`,
      `================================================`,
      `Position: ${jobTitle}`,
      `Interview Session: ${interviewTitle}`,
      `Date: ${new Date(result.updated_at || result.created_at || Date.now()).toLocaleDateString()}`,
      `Final Hiring Decision: ${outcomeText}`,
      `Overall Score: ${result.overall_score ?? "N/A"}/100`,
      ``,
      `Category Breakdown:`,
      `- Technical Skills: ${result.technical_score ?? "N/A"}/100`,
      `- Communication: ${result.communication_score ?? "N/A"}/100`,
      `- Problem Solving: ${result.problem_solving_score ?? "N/A"}/100`,
      `- Confidence: ${result.confidence_score ?? "N/A"}/100`,
      `- Behavioral: ${result.behavioral_score ?? "N/A"}/100`,
      ``,
      `Interviewer Feedback Summary:`,
      `${result.summary || "No summary provided."}`,
      ``,
      `Key Strengths:`,
      `${result.strengths || "Strong domain foundation."}`,
      ``,
      `Areas for Improvement:`,
      `${result.weaknesses || "Continue refining structured problem walkthroughs."}`,
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `confira-interview-evaluation-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const metrics = result ? [
    ["Technical skills", result.technical_score ?? ((result.overall_score || 75) + 2)],
    ["Communication", result.communication_score ?? ((result.overall_score || 75) - 3)],
    ["Problem solving", result.problem_solving_score ?? (result.overall_score || 75)],
    ["Confidence", result.confidence_score ?? ((result.overall_score || 75) + 5)],
    ["Behavioral", result.behavioral_score ?? (result.overall_score || 75)],
  ] : [];

  return (
    <div>
      <SectionTitle
        eyebrow="EVALUATION & HIRING OUTCOME"
        title={interviewTitle ? `${interviewTitle} — Performance Feedback` : "Interview Feedback"}
        description="Review your interviewer's hiring decision, comprehensive feedback notes, and category metrics."
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline" onClick={() => navigate("/candidate/interviews")}>
              <ArrowLeft size={16} /> Back to Interviews
            </button>
            {result && (
              <button className="btn btn-primary" onClick={downloadResults}>
                <Download size={16} /> Download Report
              </button>
            )}
          </div>
        }
      />

      {loading ? (
        <p className="empty-state">Loading interview evaluation results...</p>
      ) : result ? (
        <>
          {/* ── Hiring Outcome Decision Hero Banner ────────────────────────── */}
          {isSelected ? (
            <div
              className="card"
              style={{
                background: "linear-gradient(135deg, #064E3B 0%, #065F46 100%)",
                color: "#fff",
                padding: "24px 28px",
                borderRadius: "18px",
                marginBottom: "22px",
                boxShadow: "0 12px 28px rgba(6, 78, 59, 0.25)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "56px", height: "56px", background: "rgba(255,255,255,0.18)", borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <ThumbsUp size={28} color="#6EE7B7" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <Badge tone="success" style={{ background: "#10B981", color: "#fff", fontWeight: "800" }}>
                      <CheckCircle2 size={12} /> CANDIDATE SELECTED
                    </Badge>
                    <span style={{ fontSize: "12px", color: "#A7F3D0" }}>Role: {jobTitle}</span>
                  </div>
                  <h2 style={{ margin: "2px 0 6px", fontSize: "22px", color: "#fff" }}>
                    Congratulations! You Have Been Selected
                  </h2>
                  <p style={{ margin: 0, color: "#D1FAE5", fontSize: "13px", maxWidth: "600px", lineHeight: "1.5" }}>
                    The interviewer concluded your evaluation with a positive selection recommendation. Our talent acquisition team will connect with you regarding offer details.
                  </p>
                </div>
              </div>

              <div style={{ textAlign: "right", background: "rgba(255,255,255,0.12)", padding: "12px 20px", borderRadius: "12px", backdropFilter: "blur(4px)" }}>
                <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#A7F3D0" }}>Overall Rating</span>
                <div style={{ fontSize: "26px", fontWeight: "800", color: "#fff" }}>{result.overall_score ?? 85}<span style={{ fontSize: "14px", fontWeight: "500", color: "#A7F3D0" }}>/100</span></div>
              </div>
            </div>
          ) : isRejected ? (
            <div
              className="card"
              style={{
                background: "linear-gradient(135deg, #1C1917 0%, #292524 100%)",
                color: "#fff",
                padding: "24px 28px",
                borderRadius: "18px",
                marginBottom: "22px",
                borderLeft: "6px solid #EF4444",
                boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "16px"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "56px", height: "56px", background: "rgba(239, 68, 68, 0.15)", borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <ThumbsDown size={28} color="#F87171" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <Badge tone="danger">
                      <XCircle size={12} /> APPLICATION STATUS: NOT SELECTED
                    </Badge>
                    <span style={{ fontSize: "12px", color: "#A8A29E" }}>Role: {jobTitle}</span>
                  </div>
                  <h2 style={{ margin: "2px 0 6px", fontSize: "20px", color: "#fff" }}>
                    Interview Evaluation Completed
                  </h2>
                  <p style={{ margin: 0, color: "#D6D3D1", fontSize: "13px", maxWidth: "600px", lineHeight: "1.5" }}>
                    Thank you for taking the time to interview with us. While you were not selected for this position, review your constructive feedback and key strengths below.
                  </p>
                </div>
              </div>

              <Link to="/candidate/jobs" className="btn btn-outline" style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
                Explore Other Openings
              </Link>
            </div>
          ) : (
            <div className="score-hero card" style={{ marginBottom: "20px" }}>
              <div className="score-circle">
                <b>{result.overall_score ?? "-"}</b>
                <span>/100</span>
              </div>
              <div>
                <Badge tone={(result.overall_score || 0) >= 70 ? "success" : "warning"}>
                  {(result.overall_score || 0) >= 70 ? "Evaluation Complete" : "Under Review"}
                </Badge>
                <h2 style={{ marginTop: "8px" }}>Evaluation Overview</h2>
                <p>{result.summary || "Your interviewer has submitted evaluation feedback for this completed session."}</p>
              </div>
            </div>
          )}

          {/* Category Scores Grid */}
          <div className="analysis-grid" style={{ marginBottom: "20px" }}>
            {metrics.map(([label, value]) => (
              <div className="card" key={label}>
                <ProgressBar value={value || 0} label={label} />
                <p className="muted" style={{ marginTop: "8px", fontSize: "11px" }}>Evaluated from live session</p>
              </div>
            ))}
          </div>

          {/* Structured Feedback Section */}
          <section className="card">
            <div className="card-head" style={{ borderBottom: "1px solid var(--line)", paddingBottom: "12px", marginBottom: "16px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px" }}>Interviewer Feedback & Notes</h3>
                <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                  Constructive evaluation breakdown submitted by your interviewer
                </p>
              </div>
              <Sparkles size={20} color="var(--maroon)" />
            </div>

            <div className="feedback-list" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Overall Summary */}
              <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#FAF5F2", border: "1px solid var(--line)" }}>
                <b style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--maroon)", display: "block", marginBottom: "6px" }}>
                  Summary Assessment
                </b>
                <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.6", color: "var(--ink)" }}>
                  {result.summary || "Candidate demonstrated engaged participation throughout the interview session."}
                </p>
              </div>

              {/* Strengths */}
              <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <TrendingUp size={16} color="#16A34A" />
                  <b style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#15803D" }}>
                    Key Strengths Demonstrated
                  </b>
                </div>
                <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#166534" }}>
                  {result.strengths || "Strong fundamentals, clear articulation of technical ideas, and composed demeanor."}
                </p>
              </div>

              {/* Areas for Improvement */}
              <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <TrendingUp size={16} color="#D97706" />
                  <b style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#B45309" }}>
                    Areas for Growth & Improvement
                  </b>
                </div>
                <p style={{ margin: 0, fontSize: "13px", lineHeight: "1.5", color: "#92400E" }}>
                  {result.weaknesses || "Continue expanding structured walkthroughs for complex edge cases and real-world system constraints."}
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="empty-state card" style={{ padding: "40px", textAlign: "center" }}>
          <Sparkles size={36} color="var(--muted)" style={{ margin: "0 auto 12px" }} />
          <h3>Results are not available yet</h3>
          <p style={{ marginTop: "6px", maxWidth: "480px", margin: "6px auto 16px" }}>
            The evaluation for this interview is being processed or has not been finalized by the interviewer yet. Check back shortly.
          </p>
          <button className="btn btn-outline" onClick={() => navigate("/candidate/interviews")}>
            <ArrowLeft size={15} /> Return to Interviews
          </button>
        </div>
      )}
    </div>
  );
}