import { useEffect, useRef, useState, useCallback } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  MonitorUp,
  ShieldAlert,
  Activity,
  Users,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  CheckCircle2,
  Sparkles,
  Clock3,
  Radio,
  FileText,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  X
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ChatBox from "../../components/ChatBox";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

const PEER_CONFIG = {
  debug: 1,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  }
};

export default function LiveInterviewRoom() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const interviewerName = profile?.full_name || profile?.company || "Interviewer";

  const searchParams = new URLSearchParams(location.search);
  const interviewIdParam = searchParams.get("interview");
  const candidateIdParam = searchParams.get("candidate");

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Candidate Decision Modal state
  const [decisionModal, setDecisionModal] = useState({ open: false, type: "selected" });
  const [decisionFeedback, setDecisionFeedback] = useState("");
  const [decisionStrengths, setDecisionStrengths] = useState("");
  const [decisionWeaknesses, setDecisionWeaknesses] = useState("");
  const [decisionScore, setDecisionScore] = useState(85);
  const [decisionLoading, setDecisionLoading] = useState(false);

  // Media state
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [isCandidateScreenActive, setIsCandidateScreenActive] = useState(false);

  // Video refs
  const localVideoRef = useRef(null);
  const candidateCameraRef = useRef(null);
  const candidateScreenRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerRef = useRef(null);
  const channelRef = useRef(null);

  // Questions & Answers
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [candidateAnswers, setCandidateAnswers] = useState({});
  const [aiAnalyses, setAiAnalyses] = useState({});

  // Real-time Activity / Integrity Events
  const [events, setEvents] = useState([
    { level: "info", text: "Interview session initialized", time: "Just now" },
    { level: "info", text: "Waiting for candidate to connect", time: "Just now" }
  ]);

  // Timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [remainingTime, setRemainingTime] = useState("");

  const addEvent = useCallback((level, text) => {
    setEvents(prev => [
      {
        level,
        text,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      },
      ...prev
    ].slice(0, 30));
  }, []);

  // Fetch Interview Data
  useEffect(() => {
    setLoading(true);
    const fetchInterview = async () => {
      try {
        let currentInterview = null;
        if (interviewIdParam) {
          const res = await api.get(`/interviews/${interviewIdParam}`);
          currentInterview = res.data;
        } else {
          const res = await api.get("/interviews");
          const list = res.data || [];
          if (candidateIdParam) {
            currentInterview = list.find(i => i.candidate_id === candidateIdParam);
          }
          if (!currentInterview) {
            currentInterview = list.find(i => i.status === "live" || i.status === "scheduled") || list[0];
          }
        }

        if (currentInterview) {
          setInterview(currentInterview);

          // Mark room as live if not already
          if (currentInterview.status !== "live") {
            api.post(`/interviews/${currentInterview.id}/start`).catch(() => {});
          }

          // Fetch questions
          const qRes = await api.get(`/interviews/${currentInterview.id}/questions`);
          setQuestions(qRes.data || []);

          // Fetch answers
          const aRes = await api.get(`/interviews/${currentInterview.id}/answers`);
          const map = {};
          (aRes.data || []).forEach(a => {
            map[a.question_id] = a.answer_text || a.answer_transcript;
            if (a.ai_analysis) {
              setAiAnalyses(prev => ({ ...prev, [a.question_id]: a.ai_analysis }));
            }
          });
          setCandidateAnswers(map);
        } else {
          setToast("No interview session found.");
        }
      } catch (err) {
        setToast(err.message || "Failed to load interview session.");
      } finally {
        setLoading(false);
      }
    };
    fetchInterview();
  }, [interviewIdParam, candidateIdParam]);

  const roomId = interview?.meeting_room_id || interview?.id || "demo-room";
  const candidateName = interview?.candidate?.full_name || "Candidate";

  // WebRTC PeerJS + Supabase Realtime Channel
  useEffect(() => {
    if (!interview || !roomId) return;
    let mounted = true;

    async function initRoom() {
      try {
        // 1. Get Interviewer Camera & Mic
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Initialize PeerJS
        const { default: Peer } = await import("peerjs");
        const interviewerPeerId = `confira-${roomId}-interviewer`;
        const peer = new Peer(interviewerPeerId, PEER_CONFIG);
        peerRef.current = peer;

        peer.on("open", () => {
          addEvent("success", "Interviewer connected to video server");
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
            // Answer screen sharing stream
            call.answer();
            call.on("stream", screenStream => {
              if (candidateScreenRef.current) {
                candidateScreenRef.current.srcObject = screenStream;
              }
              setIsCandidateScreenActive(true);
              addEvent("success", "Candidate screen stream received");
            });
          } else {
            // Answer camera stream
            call.answer(stream);
            call.on("stream", remoteStream => {
              if (candidateCameraRef.current) {
                candidateCameraRef.current.srcObject = remoteStream;
              }
              setConnected(true);
              addEvent("success", "Candidate audio & video connected");
            });
          }
        });

        // 3. Supabase Realtime Channel
        const channel = supabase.channel(`interview_room:${roomId}`, {
          config: { broadcast: { self: false } }
        });
        channelRef.current = channel;

        channel
          .on("broadcast", { event: "candidate_online" }, () => {
            addEvent("success", `${candidateName} joined the room`);
            // Call candidate with interviewer camera stream
            const candidatePeerId = `confira-${roomId}-candidate`;
            const call = peer.call(candidatePeerId, stream, { metadata: { type: "camera" } });
            if (call) {
              call.on("stream", remoteStream => {
                if (candidateCameraRef.current) {
                  candidateCameraRef.current.srcObject = remoteStream;
                }
                setConnected(true);
              });
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
              setCandidateAnswers(prev => ({
                ...prev,
                [payload.question_id]: payload.answer
              }));
              addEvent("success", `Candidate submitted answer for Question ${payload.question_index + 1}`);

              // Fetch AI analysis
              if (interview?.id) {
                api.post("/ai/analyze-answer", {
                  interview_id: interview.id,
                  question_id: payload.question_id
                }).then(res => {
                  if (res.data) {
                    setAiAnalyses(prev => ({
                      ...prev,
                      [payload.question_id]: res.data
                    }));
                  }
                }).catch(() => {});
              }
            }
          })
          .on("broadcast", { event: "monitoring_alert" }, payload => {
            if (payload?.text) {
              addEvent(payload.level || "warning", payload.text);
            }
          })
          .subscribe(status => {
            if (status === "SUBSCRIBED") {
              channel.send({
                type: "broadcast",
                event: "interviewer_online",
                payload: { peer_id: interviewerPeerId, name: interviewerName }
              });
            }
          });

      } catch (err) {
        addEvent("critical", "Camera/microphone permission is required");
      }
    }

    initRoom();

    return () => {
      mounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [interview, roomId, candidateName, interviewerName, addEvent]);

  // Timer ticker
  useEffect(() => {
    if (!interview) return;
    const durationMins = interview.duration_minutes || 60;
    const timer = setInterval(() => {
      setSecondsElapsed(s => {
        const next = s + 1;
        const totalDurationSecs = durationMins * 60;
        const remainingSecs = Math.max(0, totalDurationSecs - next);
        const mins = Math.floor(remainingSecs / 60);
        const secs = remainingSecs % 60;
        setRemainingTime(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [interview]);

  // Media controls
  function toggleMic() {
    const next = !mic;
    setMic(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    }
  }

  function toggleCamera() {
    const next = !camera;
    setCamera(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = next; });
    }
  }

  // Question navigation and live sync
  function selectQuestion(idx) {
    setCurrentQIndex(idx);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "question_selected",
        payload: { index: idx, question_id: questions[idx]?.id }
      });
    }
    addEvent("info", `Switched to Question ${idx + 1}`);
  }

  // End interview session with decision and feedback
  async function submitDecision() {
    if (!interview?.id || !decisionModal.type) return;
    setDecisionLoading(true);
    try {
      await api.post(`/interviews/${interview.id}/decision`, {
        decision: decisionModal.type,
        feedback: decisionFeedback.trim(),
        strengths: decisionStrengths.trim(),
        weaknesses: decisionWeaknesses.trim(),
        overall_score: decisionScore
      });

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
            interview_id: interview.id
          }
        });
      }

      setDecisionModal({ open: false, type: "selected" });
      setToast("Interview concluded with decision. Redirecting to reports...");
      setTimeout(() => navigate(`/interviewer/reports?interview=${interview.id}`), 1500);
    } catch (err) {
      setToast(err.message || "Failed to end interview.");
    } finally {
      setDecisionLoading(false);
    }
  }

  function toggleFullscreenScreen() {
    if (candidateScreenRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        candidateScreenRef.current.requestFullscreen().catch(() => {});
      }
    }
  }

  if (loading) {
    return (
      <div className="live-room" style={{ padding: "40px", textAlign: "center" }}>
        <p className="empty-state">Opening live interview room...</p>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];
  const currentAnswer = currentQ ? candidateAnswers[currentQ.id] : "";
  const currentAnalysis = currentQ ? aiAnalyses[currentQ.id] : null;

  return (
    <div className="live-room interviewer-room">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* ── End Interview & Decision Modal ─────────────────────────────── */}
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
                    Candidate: <b>{candidateName}</b> · {interview?.jobs?.title || interview?.title}
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

      {/* Header */}
      <header className="live-room-header">
        <div>
          <span className="live-pill"><span className="live-dot" /> LIVE ROOM</span>
          <h1>Live Interview & Proctoring Console</h1>
          <p>
            Candidate: <b>{candidateName}</b> · {interview?.jobs?.title || "Position"} · Room: {roomId}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="live-status">
            <Clock3 size={15} /> Time Remaining: {remainingTime || "60:00"}
          </div>
          <div className="live-status">
            <Radio size={15} style={{ color: connected ? "#22c55e" : "#eab308" }} />
            {connected ? "Candidate Connected" : "Waiting for Candidate"}
          </div>
        </div>
      </header>

      {/* Main Stage */}
      <main className="live-stage">
        {/* Left Video Area */}
        <section className="video-stage">
          {/* Dual Stream Grid */}
          <div style={{ display: "grid", gridTemplateColumns: isCandidateScreenActive ? "1fr 1.2fr" : "1fr", gap: "10px", height: "540px", position: "relative" }}>
            {/* Candidate Camera Stream */}
            <div className="remote-video-panel" style={{ height: "100%" }}>
              <video ref={candidateCameraRef} autoPlay playsInline className="live-video" />
              {!connected && (
                <div className="video-placeholder">
                  <Users size={42} />
                  <b>Waiting for candidate</b>
                  <span>Candidate will appear when they join the session.</span>
                </div>
              )}
              <span className="video-tag">{candidateName.toUpperCase()} (CAMERA)</span>
            </div>

            {/* Candidate Shared Screen Stream */}
            {isCandidateScreenActive && (
              <div className="remote-video-panel" style={{ height: "100%", background: "#0a0a0c" }}>
                <video ref={candidateScreenRef} autoPlay playsInline className="live-video" style={{ objectFit: "contain" }} />
                <span className="video-tag" style={{ background: "#2563eb" }}>
                  <MonitorUp size={12} style={{ display: "inline", marginRight: "4px" }} />
                  {candidateName.toUpperCase()} (SHARED SCREEN)
                </span>
                <button
                  type="button"
                  onClick={toggleFullscreenScreen}
                  style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "6px", padding: "6px", cursor: "pointer" }}
                  title="Fullscreen Screen"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            )}

            {/* Interviewer Picture-in-Picture Local Preview */}
            <div
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                width: "130px",
                height: "90px",
                borderRadius: "10px",
                overflow: "hidden",
                border: "2px solid #fff",
                background: "#000",
                zIndex: 10,
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
              }}
            >
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <span style={{ position: "absolute", bottom: "3px", left: "5px", fontSize: "9px", color: "#fff", background: "rgba(0,0,0,0.6)", padding: "1px 4px", borderRadius: "3px" }}>
                You ({interviewerName.split(" ")[0]})
              </span>
            </div>
          </div>

          {/* Controls Strip */}
          <div className="video-controls">
            <button
              onClick={toggleMic}
              className={`round-control ${mic ? "" : "off"}`}
              title={mic ? "Mute Microphone" : "Unmute Microphone"}
              type="button"
            >
              {mic ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button
              onClick={toggleCamera}
              className={`round-control ${camera ? "" : "off"}`}
              title={camera ? "Turn Camera Off" : "Turn Camera On"}
              type="button"
            >
              {camera ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
            <button
              type="button"
              onClick={() => setDecisionModal({ open: true, type: "selected" })}
              className="end-call"
              style={{ cursor: "pointer" }}
            >
              <PhoneOff size={18} /> End Session & Evaluate
            </button>
          </div>
        </section>

        {/* Right Side Rail: Questions, Live Candidate Answer, Events, Chat */}
        <aside className="activity-rail live-activity-rail">
          {/* Question Controller */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: "8px" }}>
              <div>
                <h3>Interview Questions</h3>
                <p>Question {currentQIndex + 1} of {questions.length}</p>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  className="icon-btn"
                  style={{ width: "30px", height: "30px" }}
                  disabled={currentQIndex === 0}
                  onClick={() => selectQuestion(currentQIndex - 1)}
                  title="Previous Question"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-btn"
                  style={{ width: "30px", height: "30px" }}
                  disabled={currentQIndex === questions.length - 1}
                  onClick={() => selectQuestion(currentQIndex + 1)}
                  title="Next Question"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {currentQ && (
              <div style={{ background: "var(--cream)", padding: "12px", borderRadius: "8px", marginTop: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--maroon)", textTransform: "uppercase" }}>
                    Active on candidate screen
                  </span>
                  <Badge tone="info">{currentQ.difficulty || "Technical"}</Badge>
                </div>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "var(--ink)", lineHeight: "1.45", margin: 0 }}>
                  {currentQ.question}
                </p>
              </div>
            )}
          </div>

          {/* Live Candidate Answer & AI Evaluation */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: "6px" }}>
              <div>
                <h3>Live Candidate Response</h3>
                <p>Real-time transcript & AI signal</p>
              </div>
              {currentAnswer ? (
                <Badge tone="success"><CheckCircle2 size={12} /> Submitted</Badge>
              ) : (
                <Badge tone="warning">In progress</Badge>
              )}
            </div>

            <div style={{ minHeight: "80px", background: "var(--cream)", borderRadius: "8px", padding: "10px 12px", fontSize: "12px", color: "var(--ink)", lineHeight: "1.5" }}>
              {currentAnswer || <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Candidate has not submitted an answer for this question yet...</span>}
            </div>

            {currentAnalysis && (
              <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.06)", border: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", fontSize: "11px", color: "var(--maroon)" }}>
                  <Sparkles size={14} /> AI-Assistance Signal: {currentAnalysis.ai_assistance_score}% likelihood
                </div>
                <p style={{ fontSize: "11px", color: "var(--muted)", margin: "4px 0 0" }}>{currentAnalysis.explanation}</p>
              </div>
            )}
          </div>

          {/* Real-time Activity Feed */}
          <div className="card activity-card">
            <div className="card-head">
              <div>
                <h3>Live Activity Feed</h3>
                <p>Real-time candidate integrity stream</p>
              </div>
              <span className="live-pill small"><span className="live-dot" /> LIVE</span>
            </div>
            <div className="activity-feed" style={{ maxHeight: "160px", overflowY: "auto" }}>
              {events.map((e, i) => (
                <div className={`activity-event ${e.level}`} key={i}>
                  <span className="activity-event-icon">
                    {e.level === "critical" || e.level === "warning" ? (
                      <ShieldAlert size={14} />
                    ) : e.level === "success" ? (
                      <Users size={14} />
                    ) : (
                      <Activity size={14} />
                    )}
                  </span>
                  <div className="activity-event-body">
                    <div>
                      <b>{e.text}</b>
                      <time>{e.time}</time>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Chat */}
          <ChatBox roomId={roomId} sender={interviewerName} />
        </aside>
      </main>
    </div>
  );
}
