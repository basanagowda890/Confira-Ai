import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  ShieldCheck,
  Clock3,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Sparkles,
  Radio,
  Maximize2,
  Minimize2
} from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import ChatBox from "../../components/ChatBox";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

// Speech Recognition helper
function createRecognizer() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
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

export default function CandidateLiveInterview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const candidateName = profile?.full_name || "Candidate";

  const searchParams = new URLSearchParams(location.search);
  const interviewIdParam = searchParams.get("interview");

  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Media state
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [interviewerJoined, setInterviewerJoined] = useState(false);

  // Video refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenCallRef = useRef(null);
  const peerRef = useRef(null);
  const channelRef = useRef(null);

  // Questions & Answers state
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [speechSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const recognizerRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);

  // Interview timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [remainingTime, setRemainingTime] = useState("");

  // Load interview details
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
          currentInterview = list.find(i => i.status === "live") || list[0];
        }

        if (currentInterview) {
          setInterview(currentInterview);
          // Fetch questions
          const qRes = await api.get(`/interviews/${currentInterview.id}/questions`);
          const qList = Array.isArray(qRes) ? qRes : (qRes?.data || []);
          setQuestions(qList);

          // Fetch existing answers
          const aRes = await api.get(`/interviews/${currentInterview.id}/answers`);
          const aList = Array.isArray(aRes) ? aRes : (aRes?.data || []);
          const existing = {};
          aList.forEach(a => {
            if (a.question_id) existing[a.question_id] = true;
          });
          setSubmittedAnswers(existing);
        } else {
          setToast("No active interview found.");
        }
      } catch (err) {
        setToast(err.message || "Failed to load interview session.");
      } finally {
        setLoading(false);
      }
    };
    fetchInterview();
  }, [interviewIdParam]);

  const roomId = interview?.meeting_room_id || interview?.id || "demo-room";

  // Tab visibility listener for monitoring
  useEffect(() => {
    if (!interview?.id) return;
    const handleVisibilityChange = () => {
      const isHidden = document.hidden;
      api.post(`/interviews/${interview.id}/monitoring-events`, {
        event_type: "tab_visibility_changed",
        severity: isHidden ? "warning" : "info",
        event_data: { hidden: isHidden, timestamp: new Date().toISOString() }
      }).catch(() => {});

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "monitoring_alert",
          payload: {
            type: isHidden ? "Tab switch detected" : "Tab focus restored",
            level: isHidden ? "warning" : "info",
            text: isHidden ? `${candidateName} switched away from interview tab` : `${candidateName} returned to interview tab`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [interview?.id, candidateName]);

  // Realtime channel & WebRTC peer setup
  useEffect(() => {
    if (!interview || !roomId) return;
    let mounted = true;

    async function initLive() {
      try {
        // 1. Get Camera & Mic
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
        const candidatePeerId = `confira-${roomId}-candidate`;
        const peer = new Peer(candidatePeerId, PEER_CONFIG);
        peerRef.current = peer;

        peer.on("open", id => {
          // Announce peer on Supabase Realtime channel
          if (channelRef.current) {
            channelRef.current.send({
              type: "broadcast",
              event: "candidate_online",
              payload: { peer_id: id, name: candidateName }
            });
          }
        });

        peer.on("call", call => {
          // Answer incoming call from interviewer
          call.answer(stream);
          call.on("stream", remoteStream => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStream;
            }
            setConnected(true);
            setInterviewerJoined(true);
          });
        });

        // 3. Supabase Realtime Channel for room events
        const channel = supabase.channel(`interview_room:${roomId}`, {
          config: { broadcast: { self: false } }
        });
        channelRef.current = channel;

        channel
          .on("broadcast", { event: "interviewer_online" }, () => {
            setInterviewerJoined(true);
            // Call interviewer
            const interviewerPeerId = `confira-${roomId}-interviewer`;
            const call = peer.call(interviewerPeerId, stream, { metadata: { type: "camera" } });
            if (call) {
              call.on("stream", remoteStream => {
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = remoteStream;
                }
                setConnected(true);
              });
            }
          })
          .on("broadcast", { event: "question_selected" }, payload => {
            if (payload?.index != null) {
              setCurrentQIndex(payload.index);
              setTranscript("");
              setInterimText("");
              setSubmitResult(null);
            }
          })
          .on("broadcast", { event: "interview_ended" }, () => {
            setToast("The interviewer has concluded this session.");
            setTimeout(() => navigate(`/candidate/results?interview=${interview.id}`), 2000);
          })
          .subscribe(status => {
            if (status === "SUBSCRIBED") {
              channel.send({
                type: "broadcast",
                event: "candidate_online",
                payload: { peer_id: candidatePeerId, name: candidateName }
              });
            }
          });

      } catch (err) {
        setToast("Camera/Microphone access is required for the live room.");
      }
    }

    initLive();

    return () => {
      mounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (recognizerRef.current) {
        recognizerRef.current.stop();
      }
    };
  }, [interview, roomId, candidateName, navigate]);

  // Interview timer ticker
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

  // Media Controls
  function toggleMic() {
    const next = !mic;
    setMic(next);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = next; });
    }
    if (interview?.id) {
      api.post(`/interviews/${interview.id}/monitoring-events`, {
        event_type: next ? "microphone_unmuted" : "microphone_muted",
        severity: "info",
        event_data: { enabled: next }
      }).catch(() => {});
    }
  }

  function toggleCamera() {
    const next = !camera;
    setCamera(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = next; });
    }
    if (interview?.id) {
      api.post(`/interviews/${interview.id}/monitoring-events`, {
        event_type: next ? "camera_enabled" : "camera_disabled",
        severity: next ? "info" : "warning",
        event_data: { enabled: next }
      }).catch(() => {});
    }
  }

  // Real Screen Sharing
  async function startScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      const screenTrack = screenStream.getVideoTracks()[0];

      // Stream to interviewer via PeerJS
      if (peerRef.current) {
        const interviewerPeerId = `confira-${roomId}-interviewer`;
        const call = peerRef.current.call(interviewerPeerId, screenStream, {
          metadata: { type: "screen" }
        });
        screenCallRef.current = call;
      }

      // Notify via Realtime broadcast
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "screen_share_started",
          payload: { candidate_id: profile?.id }
        });
      }

      // Log event
      if (interview?.id) {
        api.post(`/interviews/${interview.id}/monitoring-events`, {
          event_type: "screen_share_started",
          severity: "info",
          event_data: { active: true }
        }).catch(() => {});
      }

      // Detect native browser "Stop sharing" bar click
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setToast("Screen sharing was cancelled or permission was denied.");
      } else {
        setToast("Unable to share screen. Please try again.");
      }
    }
  }

  function stopScreenShare() {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (screenCallRef.current) {
      screenCallRef.current.close();
      screenCallRef.current = null;
    }
    setIsScreenSharing(false);

    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "screen_share_stopped",
        payload: { candidate_id: profile?.id }
      });
    }

    if (interview?.id) {
      api.post(`/interviews/${interview.id}/monitoring-events`, {
        event_type: "screen_share_stopped",
        severity: "info",
        event_data: { active: false }
      }).catch(() => {});
    }
  }

  // Voice to Text
  const startListening = useCallback(() => {
    if (!speechSupported) {
      setToast("Speech recognition is not supported in this browser. Please type your answer.");
      return;
    }
    const rec = createRecognizer();
    recognizerRef.current = rec;

    rec.onstart = () => setIsListening(true);
    rec.onresult = event => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += text + " ";
        else interim += text;
      }
      if (final) setTranscript(prev => prev + final);
      setInterimText(interim);
    };
    rec.onerror = () => {
      setIsListening(false);
      setInterimText("");
    };
    rec.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    try {
      rec.start();
    } catch {}
  }, [speechSupported]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  // Submit Answer
  async function submitAnswer() {
    const question = questions[currentQIndex];
    if (!question || !interview?.id) return;

    const fullAnswer = (transcript + " " + interimText).trim();
    if (!fullAnswer) {
      setToast("Please speak or write your response before submitting.");
      return;
    }

    if (isListening) stopListening();
    setSubmitting(true);
    setSubmitResult(null);

    try {
      // 1. Save answer
      await api.put(`/interviews/${interview.id}/answers/${question.id}`, {
        answer_text: fullAnswer,
        answer_transcript: fullAnswer,
      });

      setSubmittedAnswers(prev => ({ ...prev, [question.id]: true }));

      // 2. Broadcast to Interviewer in real time
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "answer_submitted",
          payload: {
            question_id: question.id,
            question_index: currentQIndex,
            answer: fullAnswer,
            candidate_id: profile?.id,
            candidate_name: candidateName,
            submitted_at: new Date().toISOString()
          }
        });
      }

      // 3. Trigger AI assistance analysis
      try {
        const aiRes = await api.post("/ai/analyze-answer", {
          interview_id: interview.id,
          question_id: question.id
        });
        setSubmitResult({
          success: true,
          message: "Answer submitted successfully.",
          aiAnalysis: aiRes.data
        });
      } catch {
        setSubmitResult({
          success: true,
          message: "Answer submitted successfully.",
          aiAnalysis: null
        });
      }
    } catch (err) {
      setToast(err.message || "Failed to submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleNextQuestion() {
    if (currentQIndex < questions.length - 1) {
      const nextIdx = currentQIndex + 1;
      setCurrentQIndex(nextIdx);
      setTranscript("");
      setInterimText("");
      setSubmitResult(null);
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "question_selected",
          payload: { index: nextIdx, question_id: questions[nextIdx]?.id }
        });
      }
    }
  }

  function handlePrevQuestion() {
    if (currentQIndex > 0) {
      const prevIdx = currentQIndex - 1;
      setCurrentQIndex(prevIdx);
      setTranscript("");
      setInterimText("");
      setSubmitResult(null);
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "question_selected",
          payload: { index: prevIdx, question_id: questions[prevIdx]?.id }
        });
      }
    }
  }

  if (loading) {
    return (
      <div className="live-room" style={{ padding: "40px", textAlign: "center" }}>
        <p className="empty-state">Connecting to live interview workspace...</p>
      </div>
    );
  }

  const currentQ = questions[currentQIndex];
  const qText = currentQ ? (currentQ.question || currentQ.question_text || currentQ.text || `Question ${currentQIndex + 1}`) : "";
  const combinedAnswer = transcript + (interimText ? (transcript ? " " : "") + interimText : "");

  return (
    <div className="live-room">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* Header */}
      <header className="live-room-header">
        <div>
          <span className="live-pill"><span className="live-dot" /> LIVE</span>
          <h1>{interview?.title || "Technical Interview"}</h1>
          <p>
            Candidate: {candidateName} · {interview?.jobs?.title || "Position"} · Room: {roomId}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="live-status">
            <Clock3 size={15} /> Remaining: {remainingTime || "60:00"}
          </div>
          <div className="live-status">
            <Radio size={15} style={{ color: connected ? "#22c55e" : "#eab308" }} />
            {connected ? "Interviewer Connected" : "Waiting for Interviewer"}
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="live-stage">
        {/* Left Side: Video + Controls */}
        <section className="video-stage">
          {/* Remote Video (Interviewer) */}
          <div className="remote-video-panel">
            <video ref={remoteVideoRef} autoPlay playsInline className="live-video" />
            {!connected && (
              <div className="video-placeholder">
                <Users size={42} />
                <b>Waiting for interviewer</b>
                <span>The interviewer will appear here once they open the session.</span>
              </div>
            )}
            <span className="video-tag">INTERVIEWER</span>
          </div>

          {/* Local Video (Candidate) */}
          <div className="local-video-panel">
            <video ref={localVideoRef} autoPlay muted playsInline className="live-video" />
            <span className="video-tag">YOU (CANDIDATE)</span>
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
              {camera ? <Camera size={18} /> : <CameraOff size={18} />}
            </button>
            <button
              onClick={isScreenSharing ? stopScreenShare : startScreenShare}
              className={`round-control ${isScreenSharing ? "active-screen" : ""}`}
              style={{ background: isScreenSharing ? "#2563eb" : undefined }}
              title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
              type="button"
            >
              {isScreenSharing ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
            </button>
            <button
              onClick={() => {
                const stage = document.querySelector(".video-stage");
                if (document.fullscreenElement) {
                  document.exitFullscreen().catch(() => {});
                } else if (stage) {
                  stage.requestFullscreen ? stage.requestFullscreen().catch(() => {}) : stage.webkitRequestFullscreen?.();
                }
              }}
              className="round-control"
              title="Toggle Fullscreen"
              type="button"
            >
              <Maximize2 size={18} />
            </button>
            <Link to="/candidate/interviews" className="end-call">
              <PhoneOff size={18} /> Leave Room
            </Link>
          </div>

          {isScreenSharing && (
            <div style={{ position: "absolute", top: "16px", left: "16px", background: "rgba(37, 99, 235, 0.9)", color: "#fff", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="live-dot" style={{ background: "#fff" }} /> Screen sharing active
            </div>
          )}
        </section>

        {/* Right Side: Questions, Voice-to-Text & Chat */}
        <aside className="live-side-panel">
          {/* Question Card */}
          <div className="live-side-card">
            <div className="live-side-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MessageSquare size={18} />
                <b>Question {questions.length ? `${currentQIndex + 1} of ${questions.length}` : ""}</b>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: "3px 7px", fontSize: "11px" }}
                  onClick={handlePrevQuestion}
                  disabled={currentQIndex <= 0 || submitting}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ padding: "3px 7px", fontSize: "11px" }}
                  onClick={handleNextQuestion}
                  disabled={currentQIndex >= questions.length - 1 || submitting}
                >
                  Next
                </button>
                {currentQ && <Badge tone="info">{currentQ.difficulty || "Standard"}</Badge>}
              </div>
            </div>
            {currentQ ? (
              <p style={{ margin: "10px 0 6px", fontSize: "14px", fontWeight: "600", color: "var(--ink)", lineHeight: "1.5" }}>
                {qText}
              </p>
            ) : (
              <p style={{ color: "var(--muted)", fontSize: "13px" }}>
                Awaiting questions from interviewer...
              </p>
            )}
          </div>

          {/* Voice-to-Text & Answer Submission */}
          {currentQ && (
            <div className="live-side-card">
              <div className="live-side-title">
                <Mic size={18} />
                <b>Your Response</b>
                {isListening && (
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", color: "#ef4444", fontSize: "12px", fontWeight: "700" }}>
                    <span className="live-dot" style={{ background: "#ef4444" }} /> Speaking...
                  </span>
                )}
              </div>

              <textarea
                value={combinedAnswer}
                onChange={e => {
                  setTranscript(e.target.value);
                  setInterimText("");
                }}
                placeholder={isListening ? "Listening... Speak your response clearly." : "Type your answer or click Start Speaking below."}
                rows={4}
                style={{
                  width: "100%",
                  resize: "vertical",
                  borderRadius: "8px",
                  border: isListening ? "1.5px solid #ef4444" : "1px solid var(--line)",
                  background: "var(--cream)",
                  color: "var(--ink)",
                  padding: "10px 12px",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                disabled={submittedAnswers[currentQ.id] || submitting}
              />

              {/* Controls */}
              {!submittedAnswers[currentQ.id] ? (
                <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
                  {speechSupported && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={isListening ? stopListening : startListening}
                      disabled={submitting}
                    >
                      {isListening ? <><MicOff size={15} /> Stop Mic</> : <><Mic size={15} /> Start Speaking</>}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={submitAnswer}
                    disabled={submitting || !combinedAnswer.trim()}
                  >
                    {submitting ? <><Loader2 size={15} className="spin" /> Submitting...</> : <><Send size={15} /> Submit Answer</>}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", color: "var(--success)", fontSize: "13px", fontWeight: "600", flexWrap: "wrap" }}>
                  <CheckCircle2 size={16} /> Answer submitted for this question
                  {currentQIndex < questions.length - 1 && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ marginLeft: "auto" }}
                      onClick={handleNextQuestion}
                    >
                      Next Question →
                    </button>
                  )}
                </div>
              )}

              {/* AI Analysis feedback */}
              {submitResult?.aiAnalysis && (
                <div style={{ marginTop: "10px", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.06)", border: "1px solid var(--line)", fontSize: "11px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", marginBottom: "4px" }}>
                    <Sparkles size={14} style={{ color: "var(--maroon)" }} /> AI Assistance Analysis: {submitResult.aiAnalysis.ai_assistance_score}% likelihood
                  </div>
                  <p style={{ color: "var(--muted)", margin: 0 }}>{submitResult.aiAnalysis.explanation}</p>
                </div>
              )}
            </div>
          )}

          {/* Integrity Monitoring Badge */}
          <div className="live-side-card">
            <div className="live-side-title"><ShieldCheck size={18} /><b>Integrity Status</b></div>
            <div className="integrity-row"><span>Camera</span><b>{camera ? "Active" : "Disabled"}</b></div>
            <div className="integrity-row"><span>Microphone</span><b>{mic ? "Active" : "Muted"}</b></div>
            <div className="integrity-row"><span>Screen Sharing</span><b>{isScreenSharing ? "Active" : "Idle"}</b></div>
          </div>

          {/* Real-time Chat */}
          <ChatBox roomId={roomId} sender={candidateName} />
        </aside>
      </main>
    </div>
  );
}