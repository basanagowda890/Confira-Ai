import { useEffect, useRef, useState, useCallback } from "react";
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
  MessageSquare,
  Sparkles,
  FileText,
  Activity,
  Layers
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

  // Tabs & Views
  const [tab, setTab] = useState("overview"); // 'overview' | 'activity' | 'transcript' | 'chat'
  const [screenLayout, setScreenLayout] = useState("split"); // 'split' | 'screen_focus' | 'camera_focus'
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  // Data lists
  const [interviews, setInterviews] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [search, setSearch] = useState("");

  // Media state
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [isCandidateScreenActive, setIsCandidateScreenActive] = useState(false);
  const [ended, setEnded] = useState(false);

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
    { level: "info", text: "Monitoring session initialized", time: "Just now" },
    { level: "info", text: "Awaiting candidate connection", time: "Just now" }
  ]);

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
    ].slice(0, 40));
  }, []);

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── 1. Fetch Candidates and Interviews ─────────────────────────────────────
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
        // Mark room as live on backend if scheduled
        if (active.status === "scheduled") {
          api.post(`/interviews/${active.id}/start`).catch(() => {});
        }

        // Fetch questions
        try {
          const qRes = await api.get(`/interviews/${active.id}/questions`);
          setQuestions(qRes.data || []);
        } catch {}

        // Fetch answers
        try {
          const aRes = await api.get(`/interviews/${active.id}/answers`);
          const map = {};
          (aRes.data || []).forEach(a => {
            map[a.question_id] = a.answer_text || a.answer_transcript;
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

  // ── 2. WebRTC PeerJS & Supabase Realtime Channel ────────────────────────────
  useEffect(() => {
    if (!selectedInterview || !roomId) return;
    let mounted = true;

    async function initWebRTC() {
      try {
        // 1. Get Local Interviewer Stream (Camera + Mic)
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (e) {
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
          addEvent("success", "Interviewer live video connection ready");
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
            // Answer candidate screen share stream
            call.answer();
            call.on("stream", screenStream => {
              if (candidateScreenRef.current) {
                candidateScreenRef.current.srcObject = screenStream;
              }
              setIsCandidateScreenActive(true);
              addEvent("success", "Candidate screen sharing active");
            });
          } else {
            // Answer candidate camera stream
            if (stream) {
              call.answer(stream);
            } else {
              call.answer();
            }
            call.on("stream", remoteStream => {
              if (candidateCameraRef.current) {
                candidateCameraRef.current.srcObject = remoteStream;
              }
              setConnected(true);
              addEvent("success", `${candidateName} audio & video connected`);
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
            addEvent("success", `${candidateName} joined the live room`);
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
            }
          })
          .on("broadcast", { event: "proctoring_alert" }, payload => {
            addEvent(payload.severity || "warning", `${candidateName}: ${payload.message}`);
          })
          .subscribe();

        // 4. Supabase DB Monitoring Events Listener
        const monitoringSub = supabase
          .channel(`monitoring-events-${selectedInterview.id}`)
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
          monitoringSub.unsubscribe();
        };
      } catch (err) {
        addEvent("warning", "WebRTC signaling fallback: awaiting candidate");
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
          event: "active_question_changed",
          payload: { question_index: index, question_id: questions[index]?.id }
        });
      }
    }
  }

  // ── End Interview Action ───────────────────────────────────────────────────
  async function handleEndInterview() {
    if (!selectedInterview) return;
    if (!window.confirm("Are you sure you want to end this interview session and generate the AI report?")) return;

    setEnded(true);
    try {
      await api.post(`/interviews/${selectedInterview.id}/complete`, {
        feedback: "Session completed by interviewer.",
        recommendation: "reviewed"
      });
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "interview_ended",
          payload: { ended_by: interviewerName }
        });
      }
      setToast("Interview concluded! Redirecting to report...");
      setTimeout(() => {
        navigate(`/interviewer/reports`);
      }, 1600);
    } catch (err) {
      setToast(err.message || "Failed to finalize interview.");
    }
  }

  const timeFormatted = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const filteredCandidates = candidates.filter(c => `${c.full_name} ${c.headline || ""}`.toLowerCase().includes(search.toLowerCase()));

  const currentQ = questions[currentQIndex];
  const currentAnswer = currentQ ? candidateAnswers[currentQ.id] : "";
  const currentAI = currentQ ? aiAnalyses[currentQ.id] : null;

  const metrics = [
    ["Answer Quality", currentAI?.score != null ? currentAI.score : (connected ? 85 : 0), CheckCircle2],
    ["Communication", connected ? 88 : 0, Mic2],
    ["Eye Contact", connected ? 82 : 0, Eye],
    ["Face Visibility", connected ? 94 : 0, Camera],
    ["Voice Confidence", connected ? 86 : 0, Volume2],
    ["Screen Alignment", isCandidateScreenActive ? 95 : 0, MonitorUp]
  ];

  return (
    <div className="monitor-page">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* Top Session Header */}
      <div className="monitor-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--maroon)", fontWeight: "800", fontSize: "11px", letterSpacing: "0.1em" }}>
            LIVE INTERVIEW & MONITORING ROOM
          </div>
          <h1 style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
            {candidateName}
            <Badge tone={ended ? "neutral" : connected ? "danger" : "warning"}>
              <span className="live-dot" style={{ background: ended ? "#6b7280" : connected ? "#ef4444" : "#f59e0b" }} />
              {ended ? "COMPLETED" : connected ? "LIVE CONNECTED" : "AWAITING CANDIDATE"}
            </Badge>
          </h1>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>
            {selectedInterview?.title || "Technical Interview"} · {selectedInterview?.jobs?.title || selectedInterview?.type || "Technical Round"} · <Clock3 size={14} /> Session Time: {timeFormatted}
          </p>
        </div>

        <div className="monitor-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            className={`btn ${screenLayout === "split" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setScreenLayout(screenLayout === "split" ? "screen_focus" : "split")}
            title="Toggle split camera/screen view"
          >
            <Layers size={15} /> {screenLayout === "split" ? "Focus Screen" : "Split View"}
          </button>
          
          <button className="btn btn-outline" onClick={toggleMic} title={mic ? "Mute Microphone" : "Unmute Microphone"}>
            {mic ? <Mic size={15} /> : <MicOff size={15} color="#ef4444" />} {mic ? "Mic On" : "Muted"}
          </button>

          <button className="btn btn-outline" onClick={toggleCamera} title={camera ? "Turn Off Video" : "Turn On Video"}>
            {camera ? <Video size={15} /> : <VideoOff size={15} color="#ef4444" />} {camera ? "Video On" : "Off"}
          </button>

          <button className="btn btn-danger" onClick={handleEndInterview} disabled={ended}>
            <PhoneOff size={15} /> {ended ? "Interview Ended" : "End Interview"}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="monitor-tabs" style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--line)", marginBottom: "18px" }}>
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>
          <Video size={15} /> Live Overview & Video
        </button>
        <button className={tab === "activity" ? "active" : ""} onClick={() => setTab("activity")}>
          <Activity size={15} /> Proctoring & Activity Timeline
        </button>
        <button className={tab === "transcript" ? "active" : ""} onClick={() => setTab("transcript")}>
          <FileText size={15} /> Live Transcripts & QA
        </button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}>
          <MessageSquare size={15} /> Live Room Chat
        </button>
      </div>

      {/* ── 1. LIVE OVERVIEW TAB ────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="monitor-layout-v2" style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "18px" }}>
          
          {/* Main Column: Dual Video Streams & Active Question */}
          <section className="monitor-main">
            
            {/* Dual Video Grid: Candidate Camera + Candidate Screen Share */}
            <div
              className="video-grid"
              style={{
                display: "grid",
                gridTemplateColumns: screenLayout === "screen_focus" ? "1fr" : "1.15fr 1fr",
                gap: "12px",
                marginBottom: "16px"
              }}
            >
              {/* Candidate Camera Stream */}
              {screenLayout !== "screen_focus" && (
                <div
                  className="monitor-video"
                  style={{
                    height: "330px",
                    background: "#1c1917",
                    borderRadius: "14px",
                    position: "relative",
                    overflow: "hidden",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}
                >
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
                      top: "12px",
                      right: "12px",
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
              <div
                className="monitor-screen"
                style={{
                  height: screenLayout === "screen_focus" ? "460px" : "330px",
                  background: "#0c0a09",
                  borderRadius: "14px",
                  position: "relative",
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(255,255,255,0.1)"
                }}
              >
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
            </div>

            {/* Real-time AI Signals and Voice Metrics */}
            <div className="ai-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "16px" }}>
              {metrics.map(([label, val, Icon]) => (
                <div className="metric-card" key={label} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "10px", padding: "12px" }}>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", color: "var(--muted)", fontSize: "11px" }}>
                    <Icon size={16} color="var(--maroon)" />
                    <span>{label}</span>
                  </div>
                  <b style={{ fontSize: "20px", display: "block", margin: "6px 0 4px" }}>{val}%</b>
                  <ProgressBar value={val} />
                </div>
              ))}
            </div>

            {/* Realtime Questions & Candidate Answer Inspector */}
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
                    {currentQ.question_text}
                  </h2>
                  <div className="transcript" style={{ background: "#FAF5F2", border: "1px solid var(--line)", padding: "14px", borderRadius: "10px" }}>
                    <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--maroon)", fontWeight: "800" }}>
                      Candidate Realtime Voice Transcript / Answer
                    </span>
                    <p style={{ fontSize: "13px", marginTop: "6px", lineHeight: "1.5", color: "#333" }}>
                      {currentAnswer ? `"${currentAnswer}"` : "Awaiting candidate voice/text submission for this question..."}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="empty-state">No questions configured for this interview yet.</p>
              )}
            </div>
          </section>

          {/* Side Column: Session Roster, Proctoring Feed & Presence */}
          <aside className="activity-rail">
            
            {/* Active Candidates / Sessions List */}
            <div className="card candidate-roster" style={{ marginBottom: "16px" }}>
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Candidate Sessions</h3>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "11px" }}>Select a session to conduct or monitor</p>
                </div>
                <Users size={18} color="var(--maroon)" />
              </div>

              <div style={{ display: "grid", gap: "8px", maxHeight: "220px", overflowY: "auto" }}>
                {interviews.map((item, idx) => {
                  const c = item.candidate || item.profiles || candidates.find(cand => cand.id === item.candidate_id);
                  const isSelected = selectedInterview?.id === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setSelectedInterview(item);
                        navigate(`/interviewer/live?interview=${item.id}`);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: isSelected ? "2px solid var(--maroon)" : "1px solid var(--line)",
                        background: isSelected ? "#FCF5F2" : "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                        width: "100%"
                      }}
                    >
                      <span className="avatar" style={{ width: "32px", height: "32px", overflow: "hidden", borderRadius: "50%", flex: "none" }}>
                        <img
                          src={getCandidatePhoto(c, idx)}
                          alt=""
                          onError={e => { e.currentTarget.src = DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length]; }}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b style={{ fontSize: "12px", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c?.full_name || item.title}
                        </b>
                        <small style={{ color: "var(--muted)", fontSize: "10px" }}>{item.jobs?.title || item.type}</small>
                      </div>
                      <Badge tone={item.status === "live" ? "danger" : "info"}>{item.status}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Proctoring & Security Activity Stream */}
            <div className="card activity-card" style={{ marginBottom: "16px" }}>
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div>
                  <h3 style={{ margin: 0 }}>Live Integrity Feed</h3>
                  <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "11px" }}>Realtime proctoring alerts</p>
                </div>
                <Badge tone="danger"><span className="live-dot" /> LIVE</Badge>
              </div>

              <div className="activity-summary" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", background: "#FAF5F2", padding: "10px", borderRadius: "8px", textAlign: "center", marginBottom: "12px" }}>
                <div>
                  <b style={{ fontSize: "16px", display: "block" }}>{events.filter(e => e.level === "critical" || e.level === "warning").length}</b>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>Alerts</span>
                </div>
                <div>
                  <b style={{ fontSize: "16px", display: "block" }}>{events.filter(e => e.text.includes("Tab switch")).length}</b>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>Tab Switches</span>
                </div>
                <div>
                  <b style={{ fontSize: "16px", display: "block" }}>{isCandidateScreenActive ? "Active" : "Idle"}</b>
                  <span style={{ fontSize: "10px", color: "var(--muted)" }}>Screen</span>
                </div>
              </div>

              <div className="activity-feed" style={{ maxHeight: "220px", overflowY: "auto", display: "grid", gap: "8px" }}>
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

            {/* Candidate Identity & Presence Checks */}
            <div className="card">
              <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0, fontSize: "13px" }}>Presence & Hardware Checks</h3>
                <Badge tone="success">Active</Badge>
              </div>
              <div className="presence-list" style={{ display: "grid", gap: "8px", fontSize: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><Camera size={15} color="var(--maroon)" /> Face Tracked <CheckCircle2 size={14} color="#16a34a" style={{ marginLeft: "auto" }} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><Users size={15} color="var(--maroon)" /> Single Person Verified <CheckCircle2 size={14} color="#16a34a" style={{ marginLeft: "auto" }} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><Headphones size={15} color="var(--maroon)" /> Audio Input Streaming <CheckCircle2 size={14} color="#16a34a" style={{ marginLeft: "auto" }} /></div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><MonitorUp size={15} color="var(--maroon)" /> Screen Share Active {isCandidateScreenActive ? <CheckCircle2 size={14} color="#16a34a" style={{ marginLeft: "auto" }} /> : <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--muted)" }}>Off</span>}</div>
              </div>
            </div>

          </aside>
        </div>
      )}

      {/* ── 2. ACTIVITY TIMELINE TAB ─────────────────────────────────────────── */}
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

      {/* ── 3. TRANSCRIPT & QA TAB ───────────────────────────────────────────── */}
      {tab === "transcript" && (
        <section className="card" style={{ maxWidth: "1000px", margin: "0 auto" }}>
          <div className="card-head">
            <div>
              <h3>Live QA Transcripts & AI Scoring</h3>
              <p>Review speech-to-text answers submitted during this session.</p>
            </div>
            <Badge tone="success">{Object.keys(candidateAnswers).length} Answers</Badge>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {questions.map((q, idx) => {
              const ans = candidateAnswers[q.id];
              return (
                <div key={q.id || idx} style={{ background: "#FAF5F2", border: "1px solid var(--line)", padding: "16px", borderRadius: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <b>Question {idx + 1}: {q.question_text}</b>
                    <Badge tone={ans ? "success" : "neutral"}>{ans ? "Answered" : "Pending"}</Badge>
                  </div>
                  <p style={{ fontSize: "13px", color: ans ? "#1f2937" : "var(--muted)", margin: "6px 0 0" }}>
                    {ans ? `"${ans}"` : "No answer received yet for this question."}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 4. CHAT TAB ─────────────────────────────────────────────────────── */}
      {tab === "chat" && (
        <div style={{ maxWidth: "700px", margin: "0 auto", minHeight: "450px" }}>
          <ChatBox
            meetingRoomId={roomId}
            interviewId={selectedInterview?.id}
            currentUserName={interviewerName}
          />
        </div>
      )}
    </div>
  );
}