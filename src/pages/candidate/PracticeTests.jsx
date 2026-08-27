import { useEffect, useState, useRef } from "react";
import { ArrowRight, ArrowLeft, CheckCircle2, Clock3, Code2, Database, MessageCircle, RotateCcw, Sparkles, Timer, XCircle } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";

const ICON_MAP = {
  "React Fundamentals": Code2,
  "JavaScript Core & Problem Solving": Code2,
  "SQL & Relational Databases": Database,
  "Technical Communication & Behavioral": MessageCircle,
};

export default function PracticeTests() {
  const [tests, setTests] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Active test state
  const [activeTest, setActiveTest] = useState(null);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [testResult, setTestResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get("/practice-tests"),
      api.get("/practice-tests/attempts"),
    ])
      .then(([testRes, attemptRes]) => {
        setTests(testRes.data || []);
        setAttempts(attemptRes.data || []);
      })
      .catch(err => setToast(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (activeTest && !testResult && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            submitTest();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [activeTest, testResult, timeLeft]);

  async function startTest(test) {
    try {
      const res = await api.post(`/practice-tests/${test.id}/start`);
      setActiveTest(test);
      setActiveAttempt(res.data);
      setQuestionIndex(0);
      setSelectedAnswers({});
      setTestResult(null);
      setTimeLeft((test.duration_minutes || 20) * 60);
    } catch (err) {
      setToast(err.message || "Could not start practice test.");
      setTimeout(() => setToast(""), 2200);
    }
  }

  function handleSelectAnswer(questionId, answer) {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer,
    }));
  }

  async function submitTest() {
    if (!activeTest || !activeAttempt || submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const questions = activeTest.questions || [];
    const payloadAnswers = questions.map(q => ({
      question_id: q.id,
      selected_answer: selectedAnswers[q.id] || "",
    }));

    try {
      const res = await api.post(`/practice-tests/${activeTest.id}/submit`, {
        attempt_id: activeAttempt.id,
        answers: payloadAnswers,
      });
      setTestResult(res);
      loadData();
    } catch (err) {
      setToast(err.message || "Failed to submit assessment.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(""), 2200);
    }
  }

  function exitTest() {
    if (!testResult && !window.confirm("Are you sure you want to exit? Your progress in this attempt will be lost.")) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveTest(null);
    setActiveAttempt(null);
    setTestResult(null);
  }

  const formatTimer = seconds => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Render active test taking view
  if (activeTest && !testResult) {
    const questions = activeTest.questions || [];
    const currentQ = questions[questionIndex];
    const answeredCount = Object.keys(selectedAnswers).filter(k => selectedAnswers[k]).length;
    const progressPct = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

    return (
      <div className="practice-test-active">
        <Toast message={toast} onClose={() => setToast("")} />
        <div className="card" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <span className="eyebrow">PRACTICE ASSESSMENT</span>
              <h2>{activeTest.title}</h2>
              <p>Question {questionIndex + 1} of {questions.length} · {answeredCount} answered</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="live-status" style={{ fontSize: "16px", fontWeight: "bold" }}>
                <Clock3 size={18} /> {formatTimer(timeLeft)}
              </div>
              <button className="btn btn-outline" type="button" onClick={exitTest}>Exit Test</button>
            </div>
          </div>
          <ProgressBar value={progressPct} label={`Assessment progress: ${answeredCount}/${questions.length} answered`} />
        </div>

        {currentQ ? (
          <div className="card" style={{ padding: "24px" }}>
            <div className="card-head">
              <h3>Question {questionIndex + 1}</h3>
              <Badge tone="info">{currentQ.points || 20} points</Badge>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "600", margin: "16px 0" }}>{currentQ.question}</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", margin: "20px 0" }}>
              {(currentQ.options || []).map(opt => {
                const isSelected = selectedAnswers[currentQ.id] === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSelectAnswer(currentQ.id, opt)}
                    style={{
                      textAlign: "left",
                      padding: "14px 18px",
                      borderRadius: "8px",
                      border: isSelected ? "2px solid #6366f1" : "1px solid rgba(255,255,255,0.1)",
                      background: isSelected ? "rgba(99, 102, 241, 0.15)" : "rgba(255,255,255,0.03)",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        border: isSelected ? "5px solid #6366f1" : "2px solid rgba(255,255,255,0.3)",
                        display: "inline-block",
                      }}
                    />
                    {opt}
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setQuestionIndex(prev => Math.max(0, prev - 1))}
                disabled={questionIndex === 0}
              >
                <ArrowLeft size={16} /> Previous
              </button>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {questions.map((q, idx) => (
                  <button
                    key={q.id || idx}
                    type="button"
                    onClick={() => setQuestionIndex(idx)}
                    className={`filter ${questionIndex === idx ? "active" : ""}`}
                    style={{
                      minWidth: "32px",
                      padding: "4px 8px",
                      background: selectedAnswers[q.id] ? "rgba(34, 197, 94, 0.2)" : undefined,
                      borderColor: selectedAnswers[q.id] ? "#22c55e" : undefined,
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              {questionIndex === questions.length - 1 ? (
                <button className="btn btn-primary" type="button" onClick={submitTest} disabled={submitting}>
                  <Sparkles size={16} /> {submitting ? "Submitting..." : "Submit Test"}
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => setQuestionIndex(prev => Math.min(questions.length - 1, prev + 1))}
                >
                  Next <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Render test results view
  if (activeTest && testResult) {
    const questions = activeTest.questions || [];
    const score = testResult.score ?? 0;
    const isPassed = score >= 70;

    return (
      <div>
        <SectionTitle
          eyebrow="ASSESSMENT RESULT"
          title={`${activeTest.title} — Completed`}
          description="Review your performance score and question breakdown."
          action={
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-outline" onClick={() => startTest(activeTest)}>
                <RotateCcw size={16} /> Retake
              </button>
              <button className="btn btn-primary" onClick={exitTest}>
                Back to Tests
              </button>
            </div>
          }
        />

        <div className="card score-hero" style={{ marginBottom: "24px" }}>
          <div className="score-circle" style={{ borderColor: isPassed ? "#22c55e" : "#eab308" }}>
            <b>{score}</b>
            <span>/100</span>
          </div>
          <div>
            <Badge tone={isPassed ? "success" : "warning"}>
              {isPassed ? "Strong passing score" : "Review suggested"}
            </Badge>
            <h2>{isPassed ? "Great job on completing the test!" : "Assessment finished"}</h2>
            <p>
              {isPassed
                ? "Your score reflects solid comprehension of core concepts and problem solving."
                : "You completed the assessment. Review the breakdown below to target areas for review."}
            </p>
          </div>
        </div>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Answer breakdown</h3>
              <p>Review each question with correct answers</p>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {questions.map((q, idx) => {
              const userAns = selectedAnswers[q.id] || "No answer selected";
              const isCorrect = userAns.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase();

              return (
                <div
                  key={q.id || idx}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    background: isCorrect ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)",
                    border: `1px solid ${isCorrect ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)"}`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <b>Question {idx + 1}: {q.question}</b>
                    {isCorrect ? (
                      <span style={{ color: "#22c55e", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={16} /> Correct
                      </span>
                    ) : (
                      <span style={{ color: "#ef4444", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <XCircle size={16} /> Incorrect
                      </span>
                    )}
                  </div>
                  <p style={{ margin: "4px 0", fontSize: "14px" }}>
                    <strong>Your answer:</strong> {userAns}
                  </p>
                  {!isCorrect && (
                    <p style={{ margin: "4px 0", fontSize: "14px", color: "#22c55e" }}>
                      <strong>Correct answer:</strong> {q.correct_answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // Render practice tests catalog view
  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="PRACTICE"
        title="Practice tests"
        description="Prepare for interview rounds with real timed assessments and instant scoring."
      />

      {loading ? (
        <p className="empty-state">Loading practice assessments...</p>
      ) : (
        <div className="cards-2">
          {tests.map(test => {
            const Icon = ICON_MAP[test.title] || Code2;
            const pastAttempt = attempts.find(a => a.test_id === test.id && a.submitted_at);
            const questionCount = (test.questions || []).length;

            return (
              <div className="card test-card" key={test.id}>
                <div className="feature-icon">
                  <Icon size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="card-head" style={{ marginBottom: "6px" }}>
                    <h3>{test.title}</h3>
                    {pastAttempt && (
                      <Badge tone={pastAttempt.score >= 70 ? "success" : "info"}>
                        Score: {pastAttempt.score}%
                      </Badge>
                    )}
                  </div>
                  <p>{test.description || "Timed technical assessment."}</p>
                  <div className="meta-row" style={{ marginTop: "10px" }}>
                    <span><Timer size={14} /> {test.duration_minutes || 20} min</span>
                    <span><Sparkles size={14} /> {questionCount} questions</span>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => startTest(test)}>
                  Start <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {attempts.length > 0 && (
        <section className="card" style={{ marginTop: "24px" }}>
          <div className="card-head">
            <div>
              <h3>Attempt history</h3>
              <p>Your previous practice test results</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th>Date</th>
                  <th>Score</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map(attempt => (
                  <tr key={attempt.id}>
                    <td><b>{attempt.practice_tests?.title || "Practice Test"}</b></td>
                    <td>{new Date(attempt.started_at).toLocaleDateString()}</td>
                    <td>
                      <strong>{attempt.score != null ? `${attempt.score}%` : "In progress"}</strong>
                    </td>
                    <td>
                      <Badge tone={attempt.submitted_at ? (attempt.score >= 70 ? "success" : "info") : "warning"}>
                        {attempt.submitted_at ? "Completed" : "Incomplete"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}