import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic, MicOff, MessageSquare, MonitorUp, PhoneOff, Send, ShieldCheck, Users, Video, VideoOff, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

// ── Speech Recognition factory (cross-browser) ─────────────────────────────
function createRecognizer() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
}

// ── AI assistance badge helpers ─────────────────────────────────────────────
const BADGE_TONE = { low: "success", medium: "warning", high: "danger" };
function classificationColor(c) {
  return { low: "#22c55e", medium: "#f59e0b", high: "#ef4444" }[c] || "#6b7280";
}

export default function LiveInterview() {
  const { profile } = useAuth();
  const candidateName = profile?.full_name || "Candidate";
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const recognizerRef = useRef(null);

  // ── Interview session state ────────────────────────────────────────────────
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting to interview room...");
  const [roomId] = useState(() => new URLSearchParams(window.location.search).get("room") || "demo-room");
  const [interviewId] = useState(() => new URLSearchParams(window.location.search).get("interview") || "");

  // ── Questions + answers ────────────────────────────────────────────────────
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);

  // ── Voice-to-text state ────────────────────────────────────────────────────
  const [speechSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [micError, setMicError] = useState("");

  // ── Answer submit state ────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null); // { success, aiAnalysis, message }
  const [submitted, setSubmitted] = useState({}); // { [questionId]: true }

  // ── Load questions for this interview ─────────────────────────────────────
  useEffect(() => {
    if (!interviewId) return;
    api.get(`/interviews/${interviewId}/questions`)
      .then(res => setQuestions(res.data || []))
      .catch(() => {});
  }, [interviewId]);

  // ── WebRTC peer setup ──────────────────────────────────────────────────────
  useEffect(() => {
    let stream;
    let mounted = true;
    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) return;
        localVideo.current.srcObject = stream;
        const { default: Peer } = await import("peerjs");
        const { io } = await import("socket.io-client");
        const socket = io(API_BASE, { transports: ["websocket"] });
        socketRef.current = socket;
        const peer = new Peer(`candidate-${roomId}-${Math.random().toString(36).slice(2, 8)}`, {
          host: window.location.hostname,
          port: window.location.port || undefined,
          path: "/peerjs",
          secure: window.location.protocol === "https:",
        });
        peerRef.current = peer;
        peer.on("open", peerId => {
          socket.emit("join-interview", { room_id: roomId, role: "candidate", peer_id: peerId });
          setStatus("Waiting for interviewer...");
        });
        peer.on("call", call => {
          call.answer(stream);
          call.on("stream", remoteStream => {
            remoteVideo.current.srcObject = remoteStream;
            setConnected(true);
            setStatus("Live interview connected");
          });
        });
        socket.on("interviewer-joined", ({ peer_id }) => {
          setStatus("Interviewer joined — connecting...");
          const call = peer.call(peer_id, stream);
          call.on("stream", remoteStream => {
            remoteVideo.current.srcObject = remoteStream;
            setConnected(true);
            setStatus("Live interview connected");
          });
        });
      } catch (err) {
        console.error(err);
        setStatus("Camera/microphone permission is required.");
      }
    }
    start();
    return () => {
      mounted = false;
      if (stream) stream.getTracks().forEach(t => t.stop());
      socketRef.current?.disconnect();
      peerRef.current?.destroy();
    };
  }, [roomId]);

  // ── Toggle camera/mic controls (separate from speech recognition mic) ──────
  function toggleMic() {
    const next = !mic;
    setMic(next);
    localVideo.current?.srcObject?.getAudioTracks().forEach(t => { t.enabled = next; });
  }
  function toggleCamera() {
    const next = !camera;
    setCamera(next);
    localVideo.current?.srcObject?.getVideoTracks().forEach(t => { t.enabled = next; });
  }
  async function shareScreen() {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screen.getVideoTracks()[0];
      const stream = localVideo.current?.srcObject;
      if (stream) {
        const old = stream.getVideoTracks()[0];
        if (old) stream.removeTrack(old);
        stream.addTrack(videoTrack);
        localVideo.current.srcObject = stream;
      }
      videoTrack.onended = () => setCamera(true);
    } catch { /* user cancelled */ }
  }

  // ── Speech-to-text: start / stop listening ─────────────────────────────────
  const startListening = useCallback(() => {
    setMicError("");
    if (!speechSupported) {
      setMicError("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
      return;
    }
    const rec = createRecognizer();
    recognizerRef.current = rec;

    rec.onstart = () => setIsListening(true);

    rec.onresult = (event) => {
      let finalPart = "";
      let interimPart = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalPart += t + " ";
        } else {
          interimPart += t;
        }
      }
      if (finalPart) setTranscript(prev => prev + finalPart);
      setInterimText(interimPart);
    };

    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setMicError("Microphone access was denied. Please allow microphone access and try again.");
      } else if (event.error === "no-speech") {
        setMicError("No speech detected. Please speak clearly and try again.");
      } else {
        setMicError(`Speech recognition error: ${event.error}. Please try again.`);
      }
      setIsListening(false);
      setInterimText("");
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimText("");
    };

    try {
      rec.start();
    } catch (err) {
      setMicError("Unable to start speech recognition. Please refresh and try again.");
    }
  }, [speechSupported]);

  const stopListening = useCallback(() => {
    recognizerRef.current?.stop();
    setIsListening(false);
    setInterimText("");
  }, []);

  // ── Submit answer + trigger AI analysis ────────────────────────────────────
  async function submitAnswer() {
    const question = questions[currentQ];
    if (!question) return;
    if (!interviewId) {
      setSubmitResult({ success: false, message: "Interview ID is missing. Please open the interview from the Interviews page." });
      return;
    }
    const finalText = (transcript + " " + interimText).trim();
    if (!finalText) {
      setSubmitResult({ success: false, message: "Please speak your answer or type it before submitting." });
      return;
    }

    if (isListening) stopListening();
    setSubmitting(true);
    setSubmitResult(null);

    let savedAnswer = null;
    try {
      const res = await api.put(`/interviews/${interviewId}/answers/${question.id}`, {
        answer_text: finalText,
        answer_transcript: finalText,
      });
      savedAnswer = res.data;
      setSubmitted(prev => ({ ...prev, [question.id]: true }));
    } catch (err) {
      const status = err?.response?.status;
      let msg = "Failed to save your answer. Please try again.";
      if (status === 401) msg = "Session expired. Please log in again.";
      if (status === 403) msg = "You are not authorised to submit this answer.";
      if (status === 404) msg = "Interview or question not found.";
      setSubmitResult({ success: false, message: msg });
      setSubmitting(false);
      return;
    }

    // Trigger AI assistance analysis (non-blocking — answer already saved)
    try {
      const aiRes = await api.post("/ai/analyze-answer", {
        interview_id: interviewId,
        question_id: question.id,
      });
      setSubmitResult({
        success: true,
        message: "Answer saved successfully.",
        aiAnalysis: aiRes.data,
      });
    } catch {
      setSubmitResult({
        success: true,
        message: "Answer saved. AI analysis is currently unavailable.",
        aiAnalysis: null,
      });
    }

    setSubmitting(false);
  }

  function goNextQuestion() {
    setCurrentQ(q => Math.min(q + 1, questions.length - 1));
    setTranscript("");
    setInterimText("");
    setMicError("");
    setSubmitResult(null);
  }

  const question = questions[currentQ];
  const combinedTranscript = transcript + (interimText ? interimText : "");

  return (
    <div className="live-room">
      <header className="live-room-header">
        <div>
          <span className="live-pill"><span className="live-dot" /> LIVE</span>
          <h1>Technical Interview</h1>
          <p>Candidate: {candidateName} · Room: {roomId}</p>
        </div>
        <div className="live-status"><ShieldCheck size={16} /> {status}</div>
      </header>

      <main className="live-stage">
        {/* ── Video section ─────────────────────────────────────────────── */}
        <section className="video-stage">
          <div className="remote-video-panel">
            <video ref={remoteVideo} autoPlay playsInline className="live-video" />
            {!connected && (
              <div className="video-placeholder">
                <Users size={42} />
                <b>Waiting for interviewer</b>
                <span>The interviewer will appear here when they join.</span>
              </div>
            )}
            <span className="video-tag">INTERVIEWER</span>
          </div>

          <div className="local-video-panel">
            <video ref={localVideo} autoPlay muted playsInline className="live-video" />
            <span className="video-tag">YOU</span>
          </div>

          <div className="live-controls">
            <button onClick={toggleMic} className={`round-control ${mic ? "" : "off"}`} title={mic ? "Mute" : "Unmute"}>
              {mic ? <Mic /> : <MicOff />}
            </button>
            <button onClick={toggleCamera} className={`round-control ${camera ? "" : "off"}`} title={camera ? "Turn camera off" : "Turn camera on"}>
              {camera ? <Video /> : <VideoOff />}
            </button>
            <button onClick={shareScreen} className="round-control" title="Share screen"><MonitorUp /></button>
            <Link to="/candidate/dashboard" className="end-call"><PhoneOff size={18} /> Leave interview</Link>
          </div>
        </section>

        {/* ── Side panel with Q&A + Voice-to-Text ───────────────────────── */}
        <aside className="live-side-panel">

          {/* Current question card */}
          <div className="live-side-card">
            <div className="live-side-title"><MessageSquare size={18} /><b>Question {questions.length ? `${currentQ + 1} / ${questions.length}` : ""}</b></div>
            {question ? (
              <p style={{ margin: "8px 0 4px", fontSize: "0.95rem", lineHeight: 1.5 }}>{question.question}</p>
            ) : (
              <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                {interviewId ? "Loading questions…" : "Open this interview from your Interviews page to load questions."}
              </p>
            )}
          </div>

          {/* Voice-to-Text answer card */}
          {question && (
            <div className="live-side-card" style={{ gap: 10 }}>
              <div className="live-side-title">
                <Mic size={18} />
                <b>Your Answer</b>
                {isListening && (
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: "#ef4444", fontSize: "0.8rem", fontWeight: 600 }}>
                    <span className="live-dot" style={{ background: "#ef4444" }} /> Listening…
                  </span>
                )}
              </div>

              {/* Transcript editable area */}
              <div style={{ position: "relative" }}>
                <textarea
                  id="answer-transcript"
                  value={combinedTranscript}
                  onChange={e => { setTranscript(e.target.value); setInterimText(""); }}
                  placeholder={isListening ? "Speak now — transcript will appear here…" : "Click the microphone to start speaking, or type your answer directly here."}
                  rows={5}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    borderRadius: 8,
                    border: `1.5px solid ${isListening ? "#ef4444" : "#374151"}`,
                    background: "#111827",
                    color: "#f9fafb",
                    padding: "10px 12px",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                    outline: "none",
                  }}
                  disabled={submitted[question.id] || submitting}
                />
                {interimText && (
                  <span style={{ position: "absolute", bottom: 8, right: 10, fontSize: "0.75rem", color: "#9ca3af", fontStyle: "italic", pointerEvents: "none" }}>
                    …{interimText}
                  </span>
                )}
              </div>

              {/* Mic error */}
              {micError && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "#f87171", fontSize: "0.82rem", background: "rgba(239,68,68,0.08)", borderRadius: 6, padding: "6px 10px" }}>
                  <XCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} /> {micError}
                </div>
              )}

              {!speechSupported && (
                <div style={{ color: "#f59e0b", fontSize: "0.82rem", background: "rgba(245,158,11,0.08)", borderRadius: 6, padding: "6px 10px" }}>
                  ⚠ Speech recognition is not supported in this browser. Please type your answer directly or use Chrome/Edge.
                </div>
              )}

              {/* Action buttons */}
              {!submitted[question.id] ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={isListening ? stopListening : startListening}
                      disabled={submitting}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "none",
                        cursor: submitting ? "not-allowed" : "pointer",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        background: isListening ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
                        color: isListening ? "#f87171" : "#a5b4fc",
                        transition: "background 0.2s",
                      }}
                    >
                      {isListening ? <><MicOff size={15} /> Stop Recording</> : <><Mic size={15} /> Start Speaking</>}
                    </button>
                  )}
                  <button
                    type="button"
                    id="submit-answer-btn"
                    onClick={submitAnswer}
                    disabled={submitting || !combinedTranscript.trim()}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "none",
                      cursor: (submitting || !combinedTranscript.trim()) ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      background: "rgba(34,197,94,0.15)",
                      color: "#4ade80",
                      opacity: (submitting || !combinedTranscript.trim()) ? 0.5 : 1,
                      transition: "opacity 0.2s",
                    }}
                  >
                    {submitting ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Saving…</> : <><Send size={15} /> Submit Answer</>}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#4ade80", fontSize: "0.85rem", fontWeight: 600 }}>
                  <CheckCircle2 size={16} /> Answer submitted
                  {currentQ < questions.length - 1 && (
                    <button
                      type="button"
                      onClick={goNextQuestion}
                      style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 6, border: "none", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}
                    >
                      Next Question →
                    </button>
                  )}
                </div>
              )}

              {/* Submit result + AI Analysis */}
              {submitResult && (
                <div style={{ borderRadius: 8, background: "rgba(17,24,39,0.9)", border: "1px solid #374151", padding: "12px 14px", fontSize: "0.85rem", lineHeight: 1.5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontWeight: 600, color: submitResult.success ? "#4ade80" : "#f87171" }}>
                    {submitResult.success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                    {submitResult.message}
                  </div>

                  {submitResult.aiAnalysis && (
                    <div style={{ borderTop: "1px solid #374151", paddingTop: 10, marginTop: 6 }}>
                      <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: 8 }}>
                        AI Assistance Likelihood — Decision Support Only
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: "50%",
                          border: `3px solid ${classificationColor(submitResult.aiAnalysis.classification)}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontWeight: 700, fontSize: "1rem", color: classificationColor(submitResult.aiAnalysis.classification), flexShrink: 0,
                        }}>
                          {submitResult.aiAnalysis.ai_assistance_score}%
                        </div>
                        <div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", fontWeight: 700, background: `${classificationColor(submitResult.aiAnalysis.classification)}22`, color: classificationColor(submitResult.aiAnalysis.classification) }}>
                              {(submitResult.aiAnalysis.classification || "—").toUpperCase()}
                            </span>
                            <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: "0.75rem", background: "rgba(107,114,128,0.15)", color: "#9ca3af" }}>
                              {(submitResult.aiAnalysis.confidence || "—")} confidence
                            </span>
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "#9ca3af", marginTop: 4 }}>{submitResult.aiAnalysis.explanation}</div>
                        </div>
                      </div>

                      {submitResult.aiAnalysis.signals?.length > 0 && (
                        <ul style={{ margin: "0 0 8px 0", paddingLeft: 18, color: "#9ca3af", fontSize: "0.82rem" }}>
                          {submitResult.aiAnalysis.signals.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      )}

                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#6b7280", fontStyle: "italic" }}>
                        {submitResult.aiAnalysis.disclaimer}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Integrity card */}
          <div className="live-side-card">
            <div className="live-side-title"><ShieldCheck size={18} /><b>Interview integrity</b></div>
            <div className="integrity-row"><span>Camera</span><b>{camera ? "Active" : "Off"}</b></div>
            <div className="integrity-row"><span>Microphone</span><b>{mic ? "Active" : "Muted"}</b></div>
            <div className="integrity-row"><span>Screen sharing</span><b>Available</b></div>
            <p className="integrity-note">Your interview activity may be monitored according to the company's interview policy.</p>
          </div>
        </aside>
      </main>
    </div>
  );
}
