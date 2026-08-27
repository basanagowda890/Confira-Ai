import { CheckCircle2, Flag, ShieldCheck, ThumbsDown, ThumbsUp, Eye, FileText, Sparkles, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
];

function getPhoto(c, idx = 0) {
  return c?.avatar_url || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
}

export default function Recommendation() {
  const [choice, setChoice] = useState("recommended");
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [interviews, setInterviews] = useState([]);
  const [notes, setNotes] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/profiles/candidates"),
      api.get("/interviews"),
    ])
      .then(([candRes, intRes]) => {
        const cList = candRes.data || [];
        setCandidates(cList);
        if (cList.length > 0) {
          setSelectedCandidateId(cList[0].id);
        }
        setInterviews(intRes.data || []);
      })
      .catch(err => setToast(err.message));
  }, []);

  const candidate = candidates.find(c => c.id === selectedCandidateId) || candidates[0] || null;

  // Find latest interview and score for selected candidate
  const candidateInterviews = interviews.filter(i => i.candidate_id === selectedCandidateId);
  const latestInterview = candidateInterviews[0];
  const interviewResult = latestInterview?.interview_results?.[0];

  async function viewResume(candidateId) {
    try {
      const res = await api.get(`/uploads/resume/${candidateId}`);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setToast(error.message || "Resume not available.");
      setTimeout(() => setToast(""), 2200);
    }
  }

  async function saveRecommendation() {
    if (!candidate) return;
    setSaving(true);
    try {
      await api.post("/interviews/recommendations", {
        candidate_id: candidate.id,
        interview_id: latestInterview?.id,
        recommendation: choice,
        notes: notes.trim(),
      });
      setToast(`Recommendation for ${candidate.full_name} saved successfully!`);
    } catch (error) {
      setToast(error.message || "Failed to save recommendation.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 3000);
    }
  }

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="HIRING DECISION"
        title="Final recommendation"
        description="Structured decision workspace for hiring evaluation and candidate sign-off."
      />

      {/* Candidate Selector Header */}
      <section className="card" style={{ marginBottom: "20px" }}>
        <div className="form-grid" style={{ gridTemplateColumns: "1fr auto" }}>
          <label>
            Select Candidate to Review
            <select
              value={selectedCandidateId}
              onChange={e => {
                setSelectedCandidateId(e.target.value);
                setNotes("");
              }}
            >
              {candidates.map(c => (
                <option value={c.id} key={c.id}>
                  {c.full_name || "Unnamed Candidate"} — {c.headline || "Candidate"} ({c.email})
                </option>
              ))}
            </select>
          </label>

          {candidate?.resume_path && (
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => viewResume(candidate.id)}
                style={{ height: "42px" }}
              >
                <Eye size={15} /> View Candidate Resume
              </button>
            </div>
          )}
        </div>
      </section>

      {candidate ? (
        <div className="recommend-grid">
          <section className="card decision-card">
            <div className="candidate-summary">
              <span className="avatar avatar-lg" style={{ overflow: "hidden" }}>
                <img src={getPhoto(candidate)} alt={candidate.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </span>
              <div>
                <h2>{candidate.full_name}</h2>
                <p>{candidate.headline || "Candidate"}</p>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <Badge tone="info">
                    {latestInterview ? latestInterview.title : "No interview scheduled"}
                  </Badge>
                  {interviewResult?.overall_score != null ? (
                    <Badge tone="success">
                      Overall Score: {interviewResult.overall_score}%
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Score: Not available</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Score pill breakdown */}
            {interviewResult && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", margin: "16px 0", padding: "12px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                <div>
                  <small className="muted">Technical</small>
                  <h4 style={{ margin: "2px 0" }}>{interviewResult.technical_score != null ? `${interviewResult.technical_score}%` : "—"}</h4>
                </div>
                <div>
                  <small className="muted">Communication</small>
                  <h4 style={{ margin: "2px 0" }}>{interviewResult.communication_score != null ? `${interviewResult.communication_score}%` : "—"}</h4>
                </div>
                <div>
                  <small className="muted">Problem Solving</small>
                  <h4 style={{ margin: "2px 0" }}>{interviewResult.problem_solving_score != null ? `${interviewResult.problem_solving_score}%` : "—"}</h4>
                </div>
                <div>
                  <small className="muted">Confidence</small>
                  <h4 style={{ margin: "2px 0" }}>{interviewResult.confidence_score != null ? `${interviewResult.confidence_score}%` : "—"}</h4>
                </div>
              </div>
            )}

            <h3>Choose a recommendation</h3>
            <div className="decision-options">
              {[
                ["recommended", "Recommend for Hire", ThumbsUp, "Proceed to offer or final stage."],
                ["review", "Need Team Review", Flag, "Requires additional interview or review."],
                ["reject", "Do not recommend", ThumbsDown, "Do not proceed with this candidate."],
              ].map(([id, title, Icon, text]) => (
                <button
                  key={id}
                  type="button"
                  className={choice === id ? "selected" : ""}
                  onClick={() => setChoice(id)}
                >
                  <Icon size={20} />
                  <div>
                    <b>{title}</b>
                    <span>{text}</span>
                  </div>
                  {choice === id && <CheckCircle2 size={18} />}
                </button>
              ))}
            </div>

            <label>
              Decision notes & reasoning
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Add evidence, interview performance observations, and notes for the hiring committee."
                rows={4}
              />
            </label>

            <button
              className="btn btn-primary btn-lg"
              type="button"
              onClick={saveRecommendation}
              disabled={saving}
            >
              <ShieldCheck size={17} /> {saving ? "Saving decision..." : "Save recommendation"}
            </button>
          </section>

          <aside className="card">
            <div className="card-head">
              <h3>Decision checklist</h3>
            </div>
            {[
              "Review interview answers and transcript",
              "Inspect integrity and proctoring signals",
              "Verify resume match and skill requirements",
              "Consider multi-evaluator feedback",
              "Ensure objective evaluation standards",
            ].map(x => (
              <div className="check-row" key={x}>
                <CheckCircle2 size={17} />
                <span>{x}</span>
              </div>
            ))}
          </aside>
        </div>
      ) : (
        <p className="empty-state">No candidates available to review.</p>
      )}
    </div>
  );
}