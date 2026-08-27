import { useEffect, useState } from "react";
import { ArrowDownUp, CheckCircle2, Download, Star, Trophy, Users, Eye, FileText, Briefcase, GraduationCap, MapPin, Sparkles } from "lucide-react";
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

export default function CandidateComparison() {
  const [candidates, setCandidates] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/profiles/candidates"),
      api.get("/interviews"),
    ])
      .then(([candRes, intRes]) => {
        const cList = candRes.data || [];
        setCandidates(cList);
        setInterviews(intRes.data || []);
        if (cList.length >= 2) {
          setSelectedIds([cList[0].id, cList[1].id]);
        } else if (cList.length === 1) {
          setSelectedIds([cList[0].id]);
        }
      })
      .catch(err => setToast(err.message))
      .finally(() => setLoading(false));
  }, []);

  function toggleCandidate(id) {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 4) {
        setToast("You can compare up to 4 candidates at once.");
        setTimeout(() => setToast(""), 2200);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function viewResume(candidateId) {
    try {
      const res = await api.get(`/uploads/resume/${candidateId}`);
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setToast(error.message || "Resume not available.");
      setTimeout(() => setToast(""), 2500);
    }
  }

  const selectedCandidates = candidates.filter(c => selectedIds.includes(c.id));

  // Find candidate interview stats
  const getCandidateScores = candidateId => {
    const candidateInterviews = interviews.filter(
      i => i.candidate_id === candidateId && i.interview_results?.length > 0
    );
    if (!candidateInterviews.length) return null;
    const latest = candidateInterviews[0].interview_results[0];
    return latest;
  };

  const criteriaRows = [
    { label: "Technical Skills", key: "technical_score" },
    { label: "Communication", key: "communication_score" },
    { label: "Problem Solving", key: "problem_solving_score" },
    { label: "Confidence", key: "confidence_score" },
    { label: "Overall Score", key: "overall_score" },
  ];

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="COMPARISON"
        title="Compare candidates"
        description="Select candidate profiles to evaluate skills, background and assessment scores side by side."
        action={
          <button className="btn btn-outline" onClick={() => window.print()}>
            <Download size={16} /> Export comparison
          </button>
        }
      />

      {/* Candidate Selector Bar */}
      <section className="card" style={{ marginBottom: "20px" }}>
        <div className="card-head">
          <div>
            <h3>Select candidates to compare</h3>
            <p>Select up to 4 candidates from your talent pool</p>
          </div>
          <Badge tone="info">{selectedCandidates.length} selected</Badge>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
          {candidates.map((candidate, i) => {
            const isSelected = selectedIds.includes(candidate.id);
            return (
              <button
                key={candidate.id}
                type="button"
                className={`filter ${isSelected ? "active" : ""}`}
                onClick={() => toggleCandidate(candidate.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 14px",
                  borderRadius: "20px",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    flex: "none",
                    display: "inline-flex",
                    border: "1px solid rgba(255,255,255,0.2)"
                  }}
                >
                  <img src={getPhoto(candidate, i)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </span>
                {candidate.full_name || "Unnamed"}
              </button>
            );
          })}
          {!candidates.length && !loading && (
            <p className="muted">No candidates registered yet.</p>
          )}
        </div>
      </section>

      {/* Side-by-Side Candidate Cards */}
      <div className="comparison-top" style={{ display: "grid", gridTemplateColumns: `repeat(${selectedCandidates.length || 1}, 1fr)`, gap: "16px" }}>
        {selectedCandidates.map((candidate, i) => {
          const result = getCandidateScores(candidate.id);
          const score = result?.overall_score;
          return (
            <div className="card compare-card" key={candidate.id} style={{ position: "relative" }}>
              {score != null && score >= 85 && (
                <span className="winner-label">
                  <Trophy size={14} /> High Performer
                </span>
              )}
              <span className="avatar avatar-lg" style={{ overflow: "hidden" }}>
                <img src={getPhoto(candidate, i)} alt={candidate.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </span>
              <h3>{candidate.full_name || "Candidate"}</h3>
              <p style={{ minHeight: "20px" }}>{candidate.headline || "Candidate"}</p>
              <div className="big-score">
                {score != null ? `${score}%` : "—"}
              </div>
              <Badge tone={score != null ? "success" : "neutral"}>
                {score != null ? "Evaluated" : "No evaluations"}
              </Badge>

              {candidate.resume_path && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ marginTop: "12px", width: "100%", fontSize: "13px" }}
                  onClick={() => viewResume(candidate.id)}
                >
                  <Eye size={14} /> View Resume
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Detailed Comparison Table */}
      <section className="card" style={{ marginTop: "24px" }}>
        <div className="card-head">
          <div>
            <h3>Profile & Criteria Breakdown</h3>
            <p>Comprehensive side-by-side comparison across all dimensions</p>
          </div>
          <ArrowDownUp size={18} />
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "200px" }}>Dimension</th>
                {selectedCandidates.map(candidate => (
                  <th key={candidate.id}>
                    {candidate.full_name || "Candidate"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Location */}
              <tr>
                <td><b><MapPin size={14} style={{ verticalAlign: "middle" }} /> Location</b></td>
                {selectedCandidates.map(c => (
                  <td key={c.id}>{c.location || <span className="muted">Not available</span>}</td>
                ))}
              </tr>

              {/* Skills */}
              <tr>
                <td><b><Sparkles size={14} style={{ verticalAlign: "middle" }} /> Skills</b></td>
                {selectedCandidates.map(c => (
                  <td key={c.id}>
                    {c.skills?.length ? (
                      <div className="skill-row">
                        {c.skills.map(s => <span key={s}>{s}</span>)}
                      </div>
                    ) : (
                      <span className="muted">Not available</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Bio / Summary */}
              <tr>
                <td><b>About / Bio</b></td>
                {selectedCandidates.map(c => (
                  <td key={c.id} style={{ maxWidth: "260px" }}>
                    {c.bio ? <small>{c.bio}</small> : <span className="muted">Not available</span>}
                  </td>
                ))}
              </tr>

              {/* Resume */}
              <tr>
                <td><b><FileText size={14} style={{ verticalAlign: "middle" }} /> Resume</b></td>
                {selectedCandidates.map(c => (
                  <td key={c.id}>
                    {c.resume_path ? (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: "3px 8px", fontSize: "12px" }}
                        onClick={() => viewResume(c.id)}
                      >
                        <Eye size={12} /> Open PDF
                      </button>
                    ) : (
                      <span className="muted">Not available</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Evaluated Criteria Scores */}
              {criteriaRows.map(({ label, key }) => (
                <tr key={key}>
                  <td><b>{label}</b></td>
                  {selectedCandidates.map(c => {
                    const result = getCandidateScores(c.id);
                    const val = result?.[key];
                    return (
                      <td key={c.id}>
                        {val != null ? (
                          <strong style={{ color: val >= 80 ? "#22c55e" : "inherit" }}>
                            {val}%
                          </strong>
                        ) : (
                          <span className="muted">Not available</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}