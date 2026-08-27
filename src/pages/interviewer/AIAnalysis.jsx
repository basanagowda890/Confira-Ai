import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, Eye, Mic2, Search, Smile, Volume2 } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import ProgressBar from "../../components/ProgressBar";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

const classificationColor = (c) => ({ low: "#22c55e", medium: "#f59e0b", high: "#ef4444" }[c] || "#6b7280");
const classificationTone = (c) => ({ low: "success", medium: "warning", high: "danger" }[c] || "neutral");

export default function AIAnalysis() {
  const [selectedId, setSelectedId] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState("");
  const [interviews, setInterviews] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState("");
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(false);
  const realtimeRef = useRef(null);

  // Load candidate list
  useEffect(() => {
    api.get("/profiles/candidates")
      .then(res => {
        const list = res.data || [];
        setCandidates(list);
        setSelectedId(list[0]?.id || "");
      })
      .catch(() => setCandidates([]));
  }, []);

  // Load interviews for selected candidate
  useEffect(() => {
    if (!selectedId) { setInterviews([]); return; }
    api.get("/interviews")
      .then(res => {
        const list = (res.data || []).filter(i => i.candidate_id === selectedId || i.profiles?.id === selectedId);
        setInterviews(list);
        setSelectedInterview(list[0]?.id || "");
      })
      .catch(() => setInterviews([]));
  }, [selectedId]);

  // Load answers when interview selected
  useEffect(() => {
    if (!selectedInterview) { setAnswers([]); return; }
    setLoading(true);
    api.get(`/interviews/${selectedInterview}/answers`)
      .then(res => setAnswers(res.data || []))
      .catch(() => setAnswers([]))
      .finally(() => setLoading(false));

    // Supabase Realtime for live answer updates
    realtimeRef.current?.unsubscribe();
    const ch = supabase
      .channel(`ai-analysis-answers-${selectedInterview}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "interview_answers",
        filter: `interview_id=eq.${selectedInterview}`,
      }, (payload) => {
        setAnswers(prev => {
          const existing = prev.findIndex(a => a.id === payload.new?.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = payload.new;
            return updated;
          }
          return [...prev, payload.new];
        });
      })
      .subscribe();
    realtimeRef.current = ch;
    return () => ch.unsubscribe();
  }, [selectedInterview]);

  const candidate = candidates.find(c => c.id === selectedId) || { full_name: "No candidate", headline: "", id: "" };
  const filteredCandidates = candidates.filter(c => `${c.full_name} ${c.headline || ""}`.toLowerCase().includes(search.toLowerCase()));
  const selectedInterviewObj = interviews.find(i => i.id === selectedInterview);

  const behaviorMetrics = [
    ["Expression", "Happy", "82%"],
    ["Authenticity signal", "Genuine-like", "78%"],
    ["Eye contact", "Focused", "82%"],
    ["Head movement", "Normal", "76%"],
  ];
  const voiceMetrics = [
    ["Voice quality", "Clear", "87%"],
    ["Pronunciation", "Good", "90%"],
    ["Grammar", "Strong", "94%"],
    ["Pace", "Balanced", "84%"],
  ];

  return (
    <div>
      <SectionTitle
        eyebrow="AI ANALYSIS"
        title={`${candidate.full_name} — Interview insights`}
        description="A structured view of model outputs. Signals should support human review, not replace it."
        action={<Badge tone="neutral">{answers.length ? `${answers.length} answer${answers.length > 1 ? "s" : ""} reviewed` : "Awaiting interview result"}</Badge>}
      />

      {/* Candidate + Interview selector */}
      <div className="candidate-picker card">
        <div>
          <h3>Analyze candidate</h3>
          <p>Select a registered candidate and their interview to inspect available AI signals.</p>
        </div>
        <div className="candidate-picker-controls">
          <div className="search-box">
            <Search size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates..." aria-label="Search candidates" />
          </div>
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {filteredCandidates.map(c => <option value={c.id} key={c.id}>{c.full_name}</option>)}
          </select>
          {interviews.length > 0 && (
            <select value={selectedInterview} onChange={e => setSelectedInterview(e.target.value)}>
              {interviews.map(i => <option value={i.id} key={i.id}>{i.title}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Overall score hero */}
      <div className="analysis-hero card" style={{ display: "flex", alignItems: "center", gap: "18px" }}>
        <div style={{ width: "64px", height: "64px", borderRadius: "50%", overflow: "hidden", border: "2px solid var(--maroon)", flex: "none" }}>
          <img
            src={candidate.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
            alt={candidate.full_name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>{candidate.full_name || "Candidate"}</h2>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>{candidate.headline || "Candidate"} · AI insights & response evaluations</p>
        </div>
      </div>

      {/* ── AI-Assisted Answer Analysis ───────────────────────────────────────── */}
      {loading && <p className="empty-state">Loading answers…</p>}

      {!loading && answers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, margin: "18px 0" }}>
          <div className="card-head" style={{ marginBottom: 2 }}>
            <h3 style={{ margin: 0 }}>Candidate Answer Analysis</h3>
            <Badge tone="info">AI Assistance Likelihood — Not Definitive Proof</Badge>
          </div>

          {answers.map((ans, idx) => (
            <AnswerAnalysisCard key={ans.id} answer={ans} index={idx} interviewId={selectedInterview} />
          ))}
        </div>
      )}

      {!loading && !answers.length && selectedInterview && (
        <p className="empty-state">No answers submitted yet for this interview.</p>
      )}

      {/* General AI metric grids */}
      <div className="analysis-grid">
        {[["Answer quality", 0], ["Technical relevance", 0], ["Grammar", 0], ["Voice quality", 0], ["Pronunciation", 0], ["Eye contact", 0], ["Face visibility", 0], ["Head stability", 0]].map(([label, value]) => (
          <div className="card" key={label}>
            <ProgressBar value={value} label={label} />
            <p className="muted">Model confidence is shown with each metric in the production backend.</p>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head"><h3>Facial &amp; behavioral signals</h3><Eye size={19} /></div>
          <div className="signal-grid">
            {behaviorMetrics.map(x => (
              <div key={x[0]}><small>{x[0]}</small><b>{x[1]}</b><span>{x[2]} confidence</span></div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3>Voice &amp; speech</h3><Mic2 size={19} /></div>
          <div className="signal-grid">
            {voiceMetrics.map(x => (
              <div key={x[0]}><small>{x[0]}</small><b>{x[1]}</b><span>{x[2]} confidence</span></div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function AnswerAnalysisCard({ answer, index, interviewId }) {
  const hasAnalysis = answer.ai_assistance_classification != null;
  const score = answer.ai_assistance_score ?? null;
  const classification = answer.ai_assistance_classification;
  const confidence = answer.ai_assistance_confidence;
  const signals = answer.ai_assistance_signals || [];
  const explanation = answer.ai_assistance_explanation;
  const [rerunning, setRerunning] = useState(false);
  const [error, setError] = useState("");

  async function rerunAnalysis() {
    if (!answer.question_id) return;
    setRerunning(true);
    setError("");
    try {
      await api.post("/ai/analyze-answer", {
        interview_id: interviewId,
        question_id: answer.question_id,
        answer_id: answer.id,
      });
    } catch (e) {
      setError("AI analysis failed. Please try again.");
    } finally {
      setRerunning(false);
    }
  }

  return (
    <div className="card" style={{ borderLeft: hasAnalysis ? `3px solid ${classificationColor(classification)}` : "3px solid #374151" }}>
      {/* Question + Transcript */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: 4 }}>
          Answer {index + 1}
        </div>
        {answer.answer_transcript || answer.answer_text ? (
          <div>
            <div style={{ fontSize: "0.8rem", color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>TRANSCRIPT</div>
            <blockquote style={{ margin: "0 0 0 8px", padding: "8px 12px", borderLeft: "2px solid #374151", color: "#d1d5db", fontSize: "0.9rem", lineHeight: 1.6, fontStyle: "italic" }}>
              "{answer.answer_transcript || answer.answer_text}"
            </blockquote>
          </div>
        ) : (
          <span style={{ color: "#6b7280", fontSize: "0.85rem" }}>No transcript available.</span>
        )}
      </div>

      {/* AI Analysis section */}
      <div style={{ borderTop: "1px solid #374151", paddingTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <BrainCircuit size={15} style={{ color: "#818cf8" }} />
          <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#e2e8f0" }}>AI Assistance Likelihood</span>
          <Badge tone="neutral" style={{ fontSize: "0.7rem" }}>Decision Support — Not Definitive Proof</Badge>
          {!hasAnalysis && !rerunning && (
            <button
              onClick={rerunAnalysis}
              style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600 }}
            >
              Run Analysis
            </button>
          )}
          {rerunning && <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: "0.78rem" }}>Analyzing…</span>}
        </div>
        {error && <div style={{ color: "#f87171", fontSize: "0.82rem", marginBottom: 8 }}><AlertTriangle size={13} style={{ marginRight: 4 }} />{error}</div>}

        {hasAnalysis ? (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
            {/* Score circle */}
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              border: `3px solid ${classificationColor(classification)}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{ fontWeight: 800, fontSize: "1.1rem", color: classificationColor(classification) }}>{score ?? "—"}%</span>
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ padding: "3px 10px", borderRadius: 5, fontSize: "0.75rem", fontWeight: 700, background: `${classificationColor(classification)}22`, color: classificationColor(classification), textTransform: "uppercase" }}>
                  {classification}
                </span>
                <span style={{ padding: "3px 10px", borderRadius: 5, fontSize: "0.75rem", background: "rgba(107,114,128,0.15)", color: "#9ca3af" }}>
                  {confidence} confidence
                </span>
              </div>

              {signals.length > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 600, marginBottom: 3 }}>SIGNALS DETECTED</div>
                  <ul style={{ margin: 0, paddingLeft: 16, color: "#d1d5db", fontSize: "0.83rem", lineHeight: 1.6 }}>
                    {signals.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {explanation && (
                <div style={{ fontSize: "0.83rem", color: "#9ca3af", lineHeight: 1.5 }}>{explanation}</div>
              )}

              <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "#6b7280", fontStyle: "italic" }}>
                This analysis provides signals that may indicate AI assistance. It is not definitive proof that AI was used.
              </p>
            </div>
          </div>
        ) : (
          !rerunning && (
            <p style={{ color: "#6b7280", fontSize: "0.85rem", margin: 0 }}>
              No AI analysis available yet. Click "Run Analysis" above after the candidate submits an answer.
            </p>
          )
        )}
      </div>
    </div>
  );
}