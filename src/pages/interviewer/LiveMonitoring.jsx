import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Clock3,
  Eye,
  Headphones,
  MonitorUp,
  MousePointer2,
  Mic,
  MicOff,
  Mic2,
  Radio,
  ShieldAlert,
  Users,
  Volume2,
  XCircle,
  Keyboard,
  Globe2,
  AppWindow,
  Play,
  Search,
  Video,
  VideoOff,
  PhoneOff,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  MessageSquare,
  Sparkles,
  FileText,
  Activity,
  Layers,
  ThumbsUp,
  ThumbsDown,
  Check,
  X,
  BarChart2,
  TrendingUp
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import Toast from "../../components/Toast";
import ChatBox from "../../components/ChatBox";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80"
];

function getCandidatePhoto(c, idx = 0) {
  const url = c?.avatar_url;
  if (url && (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:"))) {
    return url;
  }
  return DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
}

function getQuestionText(q, idx = 0) {
  return q?.question || q?.question_text || q?.text || `Question ${idx + 1}`;
}

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  }
};

export default function LiveMonitoring() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const interviewerName = profile?.full_name || profile?.company || "Interviewer";

  const searchParams = new URLSearchParams(location.search);
  const interviewIdParam = searchParams.get("interview");
  const candidateIdParam = searchParams.get("candidate");

  // Navigation & Layout
  const [tab, setTab] = useState("overview"); // 'overview' | 'qa' | 'activity' | 'chat'
  const [screenLayout, setScreenLayout] = useState("split"); // 'split' | 'screen_focus'
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  // Data
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [search, setSearch] = useState("");

  // Media
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [isCandidateScreenActive, setIsCandidateScreenActive] = useState(false);
  const [ended, setEnded] = useState(false);

  // Video refs
  const localVideoRef = useRef(null);
  const candidateCameraRef = useRef(null);
  const candidateScreenRef = useRef(null);
  const cameraContainerRef = useRef(null);
  const screenContainerRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const channelRef = useRef(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  function toggleFullscreen(element) {
    if (!element) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => {});
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen().catch(() => {});
      }
    }
  }

  // Questions & Answers Map: { [qId]: { text, submitted_at, score } }
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [candidateAnswers, setCandidateAnswers] = useState({});
  const [aiAnalyses, setAiAnalyses] = useState({});

  // Real-time Activity / Integrity Events
  const [events, setEvents] = useState([
    { level: "info", text: "Monitoring session initialized", time: "Just now" },
    { level: "info", text: "Awaiting candidate connection", time: "Just now" }
  ]);

  // Candidate Decision Modal state
  const [decisionModal, setDecisionModal] = useState({ open: false, type: "selected" }); // type: 'selected' | 'rejected'
  const [decisionFeedback, setDecisionFeedback] = useState("");
  const [decisionStrengths, setDecisionStrengths] = useState("");
  const [decisionWeaknesses, setDecisionWeaknesses] = useState("");
  const [decisionScore, setDecisionScore] = useState(85);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [currentDecision, setCurrentDecision] = useState(null);

  // Session timer
  const [seconds, setSeconds] = useState(0);

  const addEvent = useCallback((level, text) => {
    setEvents(prev => [
      {
        level,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      },
      ...prev
    ].slice(0, 50));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── 1. Fetch Candidates, Interviews, Questions & Answers ────────────────────
  const loadInterviewData = useCallback(async () => {
    try {
      const [candRes, intRes] = await Promise.all([
        api.get("/profiles/candidates"),
        api.get("/interviews"),
      ]);

      const candList = candRes.data || [];
      const intList = intRes.data || [];

      setCandidates(candList);
      setInterviews(intList);

      // Determine active interview
      let active = null;
      if (interviewIdParam) {
        active = intList.find(i => i.id === interviewIdParam);
        if (!active) {
          try {
            const single = await api.get(`/interviews/${interviewIdParam}`);
            active = single.data;
          } catch {}
        }
      } else if (candidateIdParam) {
        active = intList.find(i => i.candidate_id === candidateIdParam);
      }

      if (!active) {
        active = intList.find(i => i.status === "live") || intList.find(i => i.status === "scheduled") || intList[0];
      }

      if (active) {
        setSelectedInterview(active);
        setEnded(active.status === "completed");

        // Mark room as live on backend if scheduled
        if (active.status === "scheduled") {
          api.post(`/interviews/${active.id}/start`).catch(() => {});
        }

        // Fetch questions
        try {
          const qRes = await api.get(`/interviews/${active.id}/questions`);
          const qList = Array.isArray(qRes) ? qRes : (qRes?.data || []);
          setQuestions(qList);
        } catch {}

        // Fetch existing answers
        try {
          const aRes = await api.get(`/interviews/${active.id}/answers`);
          const aList = Array.isArray(aRes) ? aRes : (aRes?.data || []);
          const map = {};
          aList.forEach(a => {
            map[a.question_id] = {
              text: a.answer_text || a.answer_transcript,
              submitted_at: a.submitted_at || a.created_at,
              score: a.ai_assistance_score || (a.ai_analysis && a.ai_analysis.score) || null
            };
            if (a.ai_analysis) {
              setAiAnalyses(prev => ({ ...prev, [a.question_id]: a.ai_analysis }));
            }
          });
          setCandidateAnswers(map);
        } catch {}
      }
    } catch (err) {
      setToast(err.message || "Failed to load interviews.");
    } finally {
      setLoading(false);
    }
  }, [interviewIdParam, candidateIdParam]);

  useEffect(() => {
    loadInterviewData();
  }, [loadInterviewData]);

  const activeCandidate = selectedInterview?.candidate || selectedInterview?.profiles || candidates.find(c => c.id === selectedInterview?.candidate_id) || { full_name: "Candidate", headline: "Candidate" };
  const candidateName = activeCandidate?.full_name || selectedInterview?.title?.split("—")[1]?.trim() || "Candidate";
  const roomId = selectedInterview?.meeting_room_id || selectedInterview?.id;

  // ── 2. WebRTC PeerJS & Realtime Subscriptions ──────────────────────────────
  useEffect(() => {
    if (!selectedInterview || !roomId) return;
    let mounted = true;

    async function initWebRTC() {
      try {
        // 1. Get Local Interviewer Stream
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch {}
        }

        if (!mounted) {
          stream?.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && stream) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Setup PeerJS
        const { default: Peer } = await import("peerjs");
        const interviewerPeerId = `confira-${roomId}-interviewer`;
        const peer = new Peer(interviewerPeerId, PEER_CONFIG);
        peerRef.current = peer;

        peer.on("open", () => {
          addEvent("success", "Interviewer live connection ready");
          if (channelRef.current) {
            channelRef.current.send({
              type: "broadcast",
              event: "interviewer_online",
              payload: { peer_id: interviewerPeerId, name: interviewerName }
            });
          }
        });

        peer.on("call", call => {
          if (call.metadata?.type === "screen") {
            call.answer();
            call.on("stream", screenStream => {
              if (candidateScreenRef.current) {
                candidateScreenRef.current.srcObject = screenStream;
              }
              setIsCandidateScreenActive(true);
              addEvent("success", "Candidate screen sharing active");
            });
          } else {
            if (stream) call.answer(stream);
            else call.answer();
            call.on("stream", remoteStream => {
              if (candidateCameraRef.current) {
                candidateCameraRef.current.srcObject = remoteStream;
              }
              setConnected(true);
              addEvent("success", `${candidateName} audio & video connected`);
            });
          }
        });

        // 3. Supabase Realtime Broadcast Channel
        const channel = supabase.channel(`interview_room:${roomId}`, {
          config: { broadcast: { self: false } }
        });
        channelRef.current = channel;

        channel
          .on("broadcast", { event: "candidate_online" }, () => {
            addEvent("success", `${candidateName} joined the room`);
            const candidatePeerId = `confira-${roomId}-candidate`;
            if (stream && peer) {
              const call = peer.call(candidatePeerId, stream, { metadata: { type: "camera" } });
              if (call) {
                call.on("stream", remoteStream => {
                  if (candidateCameraRef.current) {
                    candidateCameraRef.current.srcObject = remoteStream;
                  }
                  setConnected(true);
                });
              }
            }
          })
          .on("broadcast", { event: "question_selected" }, payload => {
            if (payload?.index != null && payload.index >= 0) {
              setCurrentQIndex(payload.index);
            }
          })
          .on("broadcast", { event: "screen_share_started" }, () => {
            addEvent("info", `${candidateName} started screen sharing`);
            setIsCandidateScreenActive(true);
          })
          .on("broadcast", { event: "screen_share_stopped" }, () => {
            addEvent("info", `${candidateName} stopped screen sharing`);
            setIsCandidateScreenActive(false);
            if (candidateScreenRef.current) {
              candidateScreenRef.current.srcObject = null;
            }
          })
          .on("broadcast", { event: "answer_submitted" }, payload => {
            if (payload?.question_id && payload?.answer) {
              const submitTime = payload.submitted_at || new Date().toISOString();
              setCandidateAnswers(prev => ({
                ...prev,
                [payload.question_id]: {
                  text: payload.answer,
                  submitted_at: submitTime,
                  score: payload.score || null
                }
              }));
              addEvent("success", `New answer received for Question ${(payload.question_index ?? 0) + 1} from ${payload.candidate_name || candidateName}`);
              setToast(`New answer submitted by ${candidateName}`);
            }
          })
          .on("broadcast", { event: "monitoring_alert" }, payload => {
            addEvent(payload.level || "warning", payload.text || "Integrity alert detected");
          })
          .subscribe();

        // 4. Supabase DB Postgres Changes on interview_answers (Backup Realtime)
        const answerSub = supabase
          .channel(`answers-${selectedInterview.id}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "interview_answers",
              filter: `interview_id=eq.${selectedInterview.id}`
            },
            payload => {
              const row = payload.new;
              if (row && row.question_id) {
                setCandidateAnswers(prev => ({
                  ...prev,
                  [row.question_id]: {
                    text: row.answer_text || row.answer_transcript,
                    submitted_at: row.submitted_at || row.created_at,
                    score: row.ai_assistance_score || (row.ai_analysis && row.ai_analysis.score) || null
                  }
                }));
              }
            }
          )
          .subscribe();

        // 5. Supabase DB Monitoring Events Listener
        const monitoringSub = supabase
          .channel(`monitoring-${selectedInterview.id}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "monitoring_events",
              filter: `interview_id=eq.${selectedInterview.id}`
            },
            payload => {
              const row = payload.new;
              if (row) {
                addEvent(row.severity || "warning", `${row.event_type.replace(/_/g, " ")}: ${row.details?.reason || row.details?.message || "Flagged by integrity engine"}`);
              }
            }
          )
          .subscribe();

        return () => {
          answerSub.unsubscribe();
          monitoringSub.unsubscribe();
        };
      } catch {
        addEvent("warning", "WebRTC signaling standby: awaiting candidate stream");
      }
    }

    initWebRTC();

    return () => {
      mounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, [selectedInterview, roomId, candidateName, addEvent, interviewerName]);

  // ── Media Controls ─────────────────────────────────────────────────────────
  function toggleMic() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setMic(prev => !prev);
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => {
        t.enabled = !t.enabled;
      });
      setCamera(prev => !prev);
    }
  }

  // ── Question Advance & Realtime Broadcast ──────────────────────────────────
  function handleSelectQuestion(index) {
    if (index >= 0 && index < questions.length) {
      setCurrentQIndex(index);
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "question_selected",
          payload: { index, question_id: questions[index]?.id }
        });
      }
    }
  }

  // ── Candidate Decision & End Session Action ─────────────────────────────────
  async function submitDecision() {
    if (!selectedInterview || !decisionModal.type) return;
    setDecisionLoading(true);

    try {
      await api.post(`/interviews/${selectedInterview.id}/decision`, {
        decision: decisionModal.type,
        feedback: decisionFeedback.trim(),
        strengths: decisionStrengths.trim(),
        weaknesses: decisionWeaknesses.trim(),
        overall_score: decisionScore
      });

      setCurrentDecision(decisionModal.type);
      setEnded(true);
      setToast(`Interview ended. Candidate marked as ${decisionModal.type.toUpperCase()} with feedback.`);

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "interview_ended",
          payload: {
            ended_by: interviewerName,
            decision: decisionModal.type,
            feedback: decisionFeedback.trim(),
            strengths: decisionStrengths.trim(),
            weaknesses: decisionWeaknesses.trim(),
            overall_score: decisionScore,
            interview_id: selectedInterview.id
          }
        });
      }

      setDecisionModal({ open: false, type: "selected" });
    } catch (err) {
      setToast(err.message || "Failed to record decision.");
    } finally {
      setDecisionLoading(false);
    }
  }

  // ── Progress & Metrics Calculations ────────────────────────────────────────
  const totalQuestions = questions.length;
  const answeredCount = useMemo(() => {
    return questions.filter(q => Boolean(candidateAnswers[q.id]?.text)).length;
  }, [questions, candidateAnswers]);

  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;
  const remainingCount = Math.max(0, totalQuestions - answeredCount);

  const timeFormatted = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const currentQ = questions[currentQIndex];
  const currentAnswerData = currentQ ? candidateAnswers[currentQ.id] : null;

  return (
    <div className="monitor-page">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* ── Candidate Decision & End Session Modal ─────────────────────────── */}
      {decisionModal.open && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.72)",
            display: "grid",
            placeItems: "center",
            zIndex: 9999,
            padding: "20px",
            backdropFilter: "blur(4px)"
          }}
        >
          <div
            className="card"
            style={{
              width: "100%",
              maxWidth: "580px",
              background: "#fff",
              borderRadius: "18px",
              padding: "24px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.25)",
              maxHeight: "90vh",
              overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ background: "var(--cream)", color: "var(--maroon)", padding: "10px", borderRadius: "12px" }}>
                  <PhoneOff size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px" }}>
                    End Interview Session & Record Decision
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                    Candidate: <b>{candidateName}</b> · {selectedInterview?.jobs?.title || selectedInterview?.title}
                  </p>
                </div>
              </div>
              <button className="icon-btn" onClick={() => setDecisionModal({ open: false, type: "selected" })}>
                <X size={18} />
              </button>
            </div>

            {/* Decision Selector Cards */}
            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "8px", color: "var(--ink)" }}>
              Hiring Decision Outcome:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setDecisionModal(prev => ({ ...prev, type: "selected" }))}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: `2px solid ${decisionModal.type === "selected" ? "#16a34a" : "var(--line)"}`,
                  background: decisionModal.type === "selected" ? "#F0FDF4" : "#FAF5F2",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ background: decisionModal.type === "selected" ? "#16a34a" : "#d1d5db", color: "#fff", padding: "8px", borderRadius: "8px" }}>
                  <ThumbsUp size={18} />
                </div>
                <div>
                  <b style={{ color: decisionModal.type === "selected" ? "#15803d" : "var(--ink)", display: "block", fontSize: "14px" }}>
                    Selected (Hired)
                  </b>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Candidate passed the assessment</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecisionModal(prev => ({ ...prev, type: "rejected" }))}
                style={{
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: `2px solid ${decisionModal.type === "rejected" ? "#ef4444" : "var(--line)"}`,
                  background: decisionModal.type === "rejected" ? "#FEF2F2" : "#FAF5F2",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  textAlign: "left",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{ background: decisionModal.type === "rejected" ? "#ef4444" : "#d1d5db", color: "#fff", padding: "8px", borderRadius: "8px" }}>
                  <ThumbsDown size={18} />
                </div>
                <div>
                  <b style={{ color: decisionModal.type === "rejected" ? "#b91c1c" : "var(--ink)", display: "block", fontSize: "14px" }}>
                    Rejected (Not Moving Forward)
                  </b>
                  <span style={{ fontSize: "11px", color: "var(--muted)" }}>Provide constructive guidance</span>
                </div>
              </button>
            </div>

            {/* Overall Score Slider */}
            <div style={{ background: "#FAF5F2", padding: "12px 16px", borderRadius: "12px", marginBottom: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700" }}>Overall Assessment Score:</span>
                <b style={{ fontSize: "14px", color: decisionScore >= 70 ? "#16a34a" : "#ea580c" }}>{decisionScore} / 100</b>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={decisionScore}
                onChange={e => setDecisionScore(Number(e.target.value))}
                style={{ width: "100%", accentColor: decisionModal.type === "selected" ? "#16a34a" : "#ef4444", cursor: "pointer" }}
              />
            </div>

            {/* Overall Feedback Textarea */}
            <label style={{ display: "block", marginBottom: "12px", fontSize: "12px", fontWeight: "700" }}>
              Overall Feedback & Evaluation Summary:
              <textarea
                rows={3}
                value={decisionFeedback}
                onChange={e => setDecisionFeedback(e.target.value)}
                placeholder={
                  decisionModal.type === "selected"
                    ? "e.g. Demonstrated exceptional problem-solving depth, clear React architectural knowledge, and collaborative communication."
                    : "e.g. Good fundamentals; recommend deepening hands-on knowledge in asynchronous execution and system design tradeoffs."
                }
                style={{
                  width: "100%",
                  marginTop: "4px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  resize: "vertical"
                }}
              />
            </label>

            {/* Strengths & Areas to Improve Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700" }}>
                Key Strengths:
                <input
                  type="text"
                  value={decisionStrengths}
                  onChange={e => setDecisionStrengths(e.target.value)}
                  placeholder="e.g. Quick problem decomposition, clear explanations"
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    fontSize: "12px"
                  }}
                />
              </label>
              <label style={{ fontSize: "12px", fontWeight: "700" }}>
                Areas for Improvement:
                <input
                  type="text"
                  value={decisionWeaknesses}
                  onChange={e => setDecisionWeaknesses(e.target.value)}
                  placeholder="e.g. Edge case handling, structured walkthroughs"
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--line)",
                    fontSize: "12px"
                  }}
                />
              </label>
            </div>

            <div style={{ background: "#F3F4F6", padding: "10px 14px", borderRadius: "10px", marginBottom: "18px", fontSize: "11px", color: "var(--muted)" }}>
              ℹ️ <b>Candidate Notification:</b> Ending this session will update the candidate's application, immediately deliver this feedback, and notify <b>{candidateName}</b> in real time.
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                className="btn btn-outline"
                onClick={() => setDecisionModal({ open: false, type: "selected" })}
                disabled={decisionLoading}
              >
                Cancel
              </button>
              <button
                className={`btn ${decisionModal.type === "selected" ? "btn-primary" : "btn-danger"}`}
                onClick={submitDecision}
                disabled={decisionLoading}
                style={{
                  background: decisionModal.type === "selected" ? "#16a34a" : "#ef4444",
                  borderColor: decisionModal.type === "selected" ? "#16a34a" : "#ef4444",
                  fontWeight: "700"
                }}
              >
                {decisionLoading ? "Ending Session..." : `End Session & Mark ${decisionModal.type === "selected" ? "Selected" : "Rejected"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Top Session Header ─────────────────────────────────────────────── */}
      <div className="monitor-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--maroon)", fontWeight: "800", fontSize: "11px", letterSpacing: "0.1em" }}>
            LIVE INTERVIEW & MONITORING PANEL
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0 }}>{candidateName}</h1>
            <Badge tone={ended ? (currentDecision === "selected" ? "success" : "danger") : connected ? "danger" : "warning"}>
              <span className="live-dot" style={{ background: ended ? (currentDecision === "selected" ? "#16a34a" : "#ef4444") : connected ? "#ef4444" : "#f59e0b" }} />
              {ended ? (currentDecision ? currentDecision.toUpperCase() : "COMPLETED") : connected ? "LIVE CONNECTED" : "AWAITING CANDIDATE"}
            </Badge>

            {/* Quick Candidate Switcher Dropdown */}
            {interviews.length > 1 && (
              <select
                value={selectedInterview?.id || ""}
                onChange={e => {
                  const found = interviews.find(i => i.id === e.target.value);
                  if (found) {
                    setSelectedInterview(found);
                    navigate(`/interviewer/live?interview=${found.id}`);
                  }
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--line)",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: "#FAF5F2",
                  color: "var(--ink)",
                  cursor: "pointer",
                  outline: "none"
                }}
                title="Switch candidate in live room"
              >
                {interviews.map(i => {
                  const c = i.candidate || i.profiles || candidates.find(cand => cand.id === i.candidate_id);
                  const cName = c?.full_name || i.title;
                  return (
                    <option key={i.id} value={i.id}>
                      Candidate: {cName} ({i.status.toUpperCase()})
                    </option>
                  );
                })}
              </select>
            )}
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>
            {selectedInterview?.title || "Technical Interview"} · {selectedInterview?.jobs?.title || selectedInterview?.type || "Technical Round"} · <Clock3 size={14} /> Session Time: {timeFormatted}
          </p>
        </div>

        <div className="monitor-actions" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {/* Screen Selection Controls */}
          <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: "8px", overflow: "hidden", background: "#FAF5F2" }}>
            <button
              className={`btn ${screenLayout === "split" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setScreenLayout("split")}
              style={{ border: "none", borderRadius: 0, padding: "6px 10px", fontSize: "11px" }}
              title="Split View: Camera + Screen Share"
            >
              <Layers size={13} /> Split
            </button>
            <button
              className={`btn ${screenLayout === "camera_focus" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setScreenLayout("camera_focus")}
              style={{ border: "none", borderRadius: 0, padding: "6px 10px", fontSize: "11px" }}
              title="Focus on Candidate Camera"
            >
              <Camera size={13} /> Camera
            </button>
            <button
              className={`btn ${screenLayout === "screen_focus" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setScreenLayout("screen_focus")}
              style={{ border: "none", borderRadius: 0, padding: "6px 10px", fontSize: "11px" }}
              title="Focus on Candidate Screen Share"
            >
              <MonitorUp size={13} /> Screen
            </button>
          </div>

          <button
            className="btn btn-outline"
            onClick={() => {
              const target = screenLayout === "screen_focus" ? screenContainerRef.current : cameraContainerRef.current;
              toggleFullscreen(target);
            }}
            title="Toggle full screen for selected screen"
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>

          <button className="btn btn-outline" onClick={toggleMic} title={mic ? "Mute Microphone" : "Unmute Microphone"}>
            {mic ? <Mic size={14} /> : <MicOff size={14} color="#ef4444" />}
          </button>

          <button className="btn btn-outline" onClick={toggleCamera} title={camera ? "Turn Off Video" : "Turn On Video"}>
            {camera ? <Video size={14} /> : <VideoOff size={14} color="#ef4444" />}
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ────────────────────────────────────────────────── */}
      <div className="monitor-tabs" style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--line)", marginBottom: "18px" }}>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          <Video size={15} /> Live Overview & Video
        </button>
        <button className={tab === "qa" ? "active" : ""} onClick={() => setTab("qa")}>
          <FileText size={15} /> Questions & Answers ({answeredCount}/{totalQuestions})
        </button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>
          <Activity size={15} /> Proctoring Timeline
        </button>
      </div>

      {/* ── 1. LIVE OVERVIEW TAB ────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="monitor-layout-v2" style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "18px" }}>
          
          {/* Main Column: Dual Video Streams, Active Question, Hiring Decision */}
          <section className="monitor-main">
            
            {/* Dual Video Grid: Candidate Camera + Candidate Screen Share */}
            <div
              className="video-grid"
              style={{
                display: "grid",
                gridTemplateColumns: screenLayout === "screen_focus" || screenLayout === "camera_focus" ? "1fr" : "1.15fr 1fr",
                gap: "12px",
                marginBottom: "16px"
              }}
            >
              {/* Candidate Camera Stream */}
              {screenLayout !== "screen_focus" && (
                <div
                  ref={cameraContainerRef}
                  className="monitor-video"
                  style={{
                    height: screenLayout === "camera_focus" ? "420px" : "330px",
                    background: "#1c1917",
                    borderRadius: "14px",
                    position: "relative",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}
                >
                  {/* Fullscreen Button */}
                  <button
                    type="button"
                    onClick={() => toggleFullscreen(cameraContainerRef.current)}
                    style={{
                      position: "absolute",
                      top: "10px",
                      left: "10px",
                      zIndex: 5,
                      background: "rgba(0,0,0,0.65)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      backdropFilter: "blur(4px)"
                    }}
                    title="View candidate camera in full screen"
                  >
                    <Maximize2 size={13} /> Fullscreen
                  </button>

                  <video
                    ref={candidateCameraRef}
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: connected ? "block" : "none"
                    }}
                  />
                  {!connected && (
                    <div style={{ textAlign: "center", color: "#fff", padding: "20px" }}>
                      <div className="camera-person large" style={{ width: "90px", height: "90px", margin: "0 auto 12px", borderRadius: "50%", overflow: "hidden", border: "2px solid var(--maroon)" }}>
                        <img
                          src={getCandidatePhoto(activeCandidate)}
                          alt={candidateName}
                          onError={e => { e.currentTarget.src = DEFAULT_AVATARS[0]; }}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                      <b style={{ display: "block", fontSize: "15px" }}>{candidateName}</b>
                      <small style={{ color: "#a8a29e", fontSize: "11px" }}>Connecting via WebRTC signaling...</small>
                    </div>
                  )}

                  {/* Picture-in-Picture Local Interviewer Preview */}
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      width: "88px",
                      height: "64px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      border: "1.5px solid #fff",
                      background: "#000",
                      zIndex: 3
                    }}
                  >
                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <span style={{ position: "absolute", bottom: "2px", left: "4px", fontSize: "8px", color: "#fff", background: "rgba(0,0,0,0.6)", padding: "1px 3px", borderRadius: "3px" }}>
                      You ({interviewerName.split(" ")[0]})
                    </span>
                  </div>

                  <span className="video-label" style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "11px" }}>
                    {candidateName} (Camera)
                  </span>
                  <span className="video-badge" style={{ position: "absolute", bottom: "10px", right: "10px", background: connected ? "#16a34a" : "#ca8a04", color: "#fff", padding: "3px 7px", borderRadius: "5px", fontSize: "10px", fontWeight: "700" }}>
                    {connected ? "Camera Live" : "Connecting"}
                  </span>
                </div>
              )}

              {/* Candidate Screen Sharing Stream */}
              {screenLayout !== "camera_focus" && (
                <div
                  ref={screenContainerRef}
                  className="monitor-screen"
                  style={{
                    height: screenLayout === "screen_focus" ? "420px" : "330px",
                    background: "#0c0a09",
                    borderRadius: "14px",
                    position: "relative",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}
                >
                  {/* Fullscreen Button */}
                  <button
                    type="button"
                    onClick={() => toggleFullscreen(screenContainerRef.current)}
                    style={{
                      position: "absolute",
                      top: "10px",
                      left: "10px",
                      zIndex: 5,
                      background: "rgba(0,0,0,0.65)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "4px 8px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      backdropFilter: "blur(4px)"
                    }}
                    title="View candidate screen share in full screen"
                  >
                    <Maximize2 size={13} /> Fullscreen
                  </button>

                  <video
                    ref={candidateScreenRef}
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: isCandidateScreenActive ? "block" : "none"
                    }}
                  />
                  {!isCandidateScreenActive && (
                    <div style={{ textAlign: "center", color: "#78716c" }}>
                      <MonitorUp size={38} style={{ margin: "0 auto 8px", opacity: 0.6 }} />
                      <b style={{ display: "block", fontSize: "13px", color: "#d6d3d1" }}>Candidate Screen Share</b>
                      <small style={{ fontSize: "11px" }}>Screen stream activates when candidate shares desktop</small>
                    </div>
                  )}
                  <span className="video-label" style={{ position: "absolute", bottom: "10px", left: "10px", background: "rgba(0,0,0,0.6)", color: "#fff", padding: "4px 8px", borderRadius: "6px", fontSize: "11px" }}>
                    Candidate Screen Stream
                  </span>
                  <span className="video-badge" style={{ position: "absolute", bottom: "10px", right: "10px", background: isCandidateScreenActive ? "#16a34a" : "#44403c", color: "#fff", padding: "3px 7px", borderRadius: "5px", fontSize: "10px", fontWeight: "700" }}>
                    {isCandidateScreenActive ? "Sharing Active" : "No Screen Shared"}
                  </span>
                </div>
              )}
            </div>

            {/* Active Question & Live Candidate Response */}
            <div className="card" style={{ marginBottom: "16px" }}>
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Active Interview Question</h3>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                    Question {questions.length ? currentQIndex + 1 : 0} of {questions.length || 1} · Synchronized live with candidate
                  </p>
                </div>
                
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    className="btn btn-outline"
                    onClick={() => handleSelectQuestion(currentQIndex - 1)}
                    disabled={currentQIndex <= 0}
                    style={{ padding: "6px 10px", fontSize: "11px" }}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleSelectQuestion(currentQIndex + 1)}
                    disabled={currentQIndex >= questions.length - 1}
                    style={{ padding: "6px 10px", fontSize: "11px" }}
                  >
                    Next Question <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {currentQ ? (
                <div>
                  <h2 className="question" style={{ fontSize: "17px", lineHeight: "1.4", margin: "0 0 12px", color: "var(--ink)" }}>
                    {getQuestionText(currentQ, currentQIndex)}
                  </h2>
                  
                  <div className="transcript" style={{ background: "#FAF5F2", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--maroon)", fontWeight: "800" }}>
                        Candidate Answer
                      </span>
                      {currentAnswerData?.submitted_at && (
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          Submitted: {new Date(currentAnswerData.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: "13px", margin: 0, lineHeight: "1.5", color: "#333", whiteSpace: "pre-wrap" }}>
                      {currentAnswerData?.text ? `"${currentAnswerData.text}"` : "Awaiting candidate response for this question..."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="empty-state">No questions configured for this interview yet.</p>
              )}
            </div>

            {/* Candidate Hiring Decision Card */}
            <div className="card" style={{ background: "#FAF5F2", border: "1px solid var(--line)", padding: "18px 20px", borderRadius: "14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <b style={{ fontSize: "15px", display: "block" }}>Conclude Session & Final Evaluation</b>
                <p style={{ margin: "3px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                  End the live session, record your selection/rejection decision, and send constructive feedback to {candidateName}.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  className="btn btn-danger"
                  onClick={() => setDecisionModal({ open: true, type: "selected" })}
                  style={{ padding: "9px 16px", fontWeight: "700" }}
                >
                  <PhoneOff size={15} /> End Session & Evaluate
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setDecisionModal({ open: true, type: "selected" })}
                  style={{ borderColor: "#16a34a", color: "#16a34a", padding: "8px 14px", fontWeight: "700" }}
                >
                  <ThumbsUp size={14} /> Select
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => setDecisionModal({ open: true, type: "rejected" })}
                  style={{ borderColor: "#ef4444", color: "#ef4444", padding: "8px 14px", fontWeight: "700" }}
                >
                  <ThumbsDown size={14} /> Reject
                </button>
              </div>
            </div>

          </section>

          {/* Side Column: Chart & Interview Progress + Sessions + Integrity */}
          <aside className="activity-rail">
            
            {/* Live Room Chart (Integrated directly above Interview Progress) */}
            <div className="card" style={{ marginBottom: "16px", padding: "16px", borderRadius: "14px" }}>
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "13px" }}>Interview Progress & Chart</h3>
                <Badge tone={progressPercent === 100 ? "success" : "info"}>{progressPercent}%</Badge>
              </div>

              {/* Radial Progress Gauge */}
              <div style={{ textAlign: "center", background: "#FAF5F2", padding: "14px 10px", borderRadius: "10px", marginBottom: "12px" }}>
                <div style={{ position: "relative", width: "104px", height: "104px", margin: "0 auto" }}>
                  <svg width="104" height="104" viewBox="0 0 104 104">
                    <circle
                      cx="52"
                      cy="52"
                      r="44"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="8"
                    />
                    <circle
                      cx="52"
                      cy="52"
                      r="44"
                      fill="none"
                      stroke="var(--maroon)"
                      strokeWidth="8"
                      strokeDasharray={276.46}
                      strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                      strokeLinecap="round"
                      transform="rotate(-90 52 52)"
                      style={{ transition: "stroke-dashoffset 0.6s ease" }}
                    />
                  </svg>
                  <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "grid", placeContent: "center" }}>
                    <b style={{ fontSize: "18px", color: "var(--maroon)" }}>{progressPercent}%</b>
                    <small style={{ fontSize: "9px", color: "var(--muted)" }}>Progress</small>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: "14px", marginTop: "10px" }}>
                  <div>
                    <b style={{ fontSize: "14px", color: "#16a34a" }}>{answeredCount}</b>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>Answered</span>
                  </div>
                  <div>
                    <b style={{ fontSize: "14px", color: "#ca8a04" }}>{remainingCount}</b>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>Remaining</span>
                  </div>
                  <div>
                    <b style={{ fontSize: "14px", color: "var(--ink)" }}>{totalQuestions}</b>
                    <span style={{ display: "block", fontSize: "10px", color: "var(--muted)" }}>Total</span>
                  </div>
                </div>
              </div>

              {/* Question Progress Bars */}
              <div style={{ display: "grid", gap: "6px", maxHeight: "140px", overflowY: "auto", paddingRight: "4px" }}>
                {questions.map((q, idx) => {
                  const ans = candidateAnswers[q.id];
                  const isAnswered = Boolean(ans?.text);
                  const charCount = (ans?.text || "").length;
                  const fillWidth = isAnswered ? Math.min(100, Math.max(30, Math.round(charCount / 3))) : 0;
                  const qText = getQuestionText(q, idx);

                  return (
                    <div key={q.id || idx}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", marginBottom: "2px" }}>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                          <b>Q{idx + 1}:</b> {qText}
                        </span>
                        <span style={{ color: isAnswered ? "#16a34a" : "var(--muted)", fontWeight: "600", fontSize: "9px" }}>
                          {isAnswered ? "Submitted" : "Pending"}
                        </span>
                      </div>
                      <div style={{ height: "6px", background: "#f3f4f6", borderRadius: "3px", overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            width: `${fillWidth}%`,
                            background: isAnswered ? "#16a34a" : "#d1d5db",
                            borderRadius: "3px",
                            transition: "width 0.5s ease"
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>



            {/* Interview Chat (Embedded directly next to screens) */}
            <div style={{ marginBottom: "16px" }}>
              <ChatBox
                roomId={roomId}
                meetingRoomId={roomId}
                interviewId={selectedInterview?.id}
                sender={interviewerName}
                currentUserName={interviewerName}
              />
            </div>

            {/* Live Proctoring & Security Activity Stream */}
            <div className="card activity-card">
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "13px" }}>Live Integrity Feed</h3>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "11px" }}>Realtime proctoring alerts</p>
                </div>
                <Badge tone="danger"><span className="live-dot" /> LIVE</Badge>
              </div>

              <div className="activity-feed" style={{ maxHeight: "180px", overflowY: "auto", display: "grid", gap: "8px" }}>
                {events.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "flex-start",
                      fontSize: "11px",
                      padding: "6px 8px",
                      borderRadius: "6px",
                      background: ev.level === "critical" ? "#FEF2F2" : ev.level === "warning" ? "#FFFBEB" : "#F8FAFC",
                      borderLeft: `3px solid ${ev.level === "critical" ? "#ef4444" : ev.level === "warning" ? "#f59e0b" : "#3b82f6"}`
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: "600", color: "#1e293b" }}>{ev.text}</p>
                      <span style={{ fontSize: "9px", color: "var(--muted)" }}>{ev.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </aside>
        </div>
      )}

      {/* ── 2. QUESTIONS & ANSWERS FLOW TAB ─────────────────────────────────── */}
      {tab === "qa" && (
        <section className="card" style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0 }}>Interview Questions & Candidate Answers</h3>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "12px" }}>
                Candidate: <b>{candidateName}</b> · Answered {answeredCount} of {totalQuestions} Questions
              </p>
            </div>
            <Badge tone={answeredCount === totalQuestions && totalQuestions > 0 ? "success" : "info"}>
              {progressPercent}% Complete
            </Badge>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {questions.map((q, idx) => {
              const ans = candidateAnswers[q.id];
              const isAnswered = Boolean(ans?.text);
              const qText = getQuestionText(q, idx);

              return (
                <div
                  key={q.id || idx}
                  style={{
                    background: isAnswered ? "#FAFDF8" : "#FAF5F2",
                    border: `1px solid ${isAnswered ? "#bbf7d0" : "var(--line)"}`,
                    padding: "16px 20px",
                    borderRadius: "12px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--maroon)", letterSpacing: "0.08em" }}>
                        QUESTION {idx + 1}
                      </span>
                      <h4 style={{ margin: "4px 0", fontSize: "15px", color: "var(--ink)" }}>
                        {qText}
                      </h4>
                    </div>
                    <Badge tone={isAnswered ? "success" : "neutral"}>
                      {isAnswered ? "Answered" : "Pending Answer"}
                    </Badge>
                  </div>

                  <div style={{ background: "#fff", border: "1px solid var(--line)", padding: "12px 14px", borderRadius: "8px", marginTop: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <b style={{ fontSize: "12px", color: "var(--ink)" }}>Candidate Answer:</b>
                      {ans?.submitted_at && (
                        <span style={{ fontSize: "11px", color: "var(--muted)" }}>
                          Submitted: {new Date(ans.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: isAnswered ? "#1f2937" : "var(--muted)", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
                      {isAnswered ? `"${ans.text}"` : "The candidate has not submitted an answer for this question yet."}
                    </p>
                  </div>
                </div>
              );
            })}
            {!questions.length && <p className="empty-state">No questions found for this interview.</p>}
          </div>
        </section>
      )}

      {/* ── 3. ACTIVITY TIMELINE TAB ─────────────────────────────────────────── */}
      {tab === "activity" && (
        <section className="card timeline-card" style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div className="card-head">
            <div>
              <h3>Session Activity & Proctoring Timeline</h3>
              <p>Complete record of integrity events, tab switches, and milestone timestamps.</p>
            </div>
            <Badge tone="info">Live Stream</Badge>
          </div>
          <div className="timeline">
            {events.map((e, idx) => (
              <div className="timeline-item" key={idx}>
                <time>{e.time}</time>
                <span className={`timeline-dot ${e.level}`} />
                <div>
                  <b>{e.text}</b>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "11px" }}>Logged during live interview monitoring</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}