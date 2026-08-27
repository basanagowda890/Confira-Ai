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
  MessageSquare
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

  // End interview session
  async function endInterview() {
    if (!interview?.id) return;
    try {
      await api.post(`/interviews/${interview.id}/complete`);
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "interview_ended",
          payload: { interview_id: interview.id }
        });
      }
      setToast("Interview concluded. Redirecting to reports...");
      setTimeout(() => navigate(`/interviewer/reports?interview=${interview.id}`), 1500);
    } catch (err) {
      setToast(err.message || "Failed to end interview.");
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
          <button className="btn btn-danger btn-sm" onClick={endInterview}>
            <PhoneOff size={15} /> End Interview
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <main className="live-stage">
        {/* Left Video Area */}
        <section className="video-stage">
          {/* Dual Stream Grid */}
          <div style={{ display: "grid", gridTemplateColumns: isCandidateScreenActive ? "1fr 1.2fr" : "1fr", gap: "10px", height: "540px" }}>
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
          </div>

          {/* Local Interviewer Video Thumbnail */}
          <div className="local-video-panel">
            <video ref={localVideoRef} autoPlay muted playsInline className="live-video" />
            <span className="video-tag">YOU (INTERVIEWER)</span>
          </div>

          {/* Controls Bar */}
          <div className="live-controls">
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
            <Link to="/interviewer/interviews" className="end-call">
              <PhoneOff size={18} /> Exit Console
            </Link>
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
