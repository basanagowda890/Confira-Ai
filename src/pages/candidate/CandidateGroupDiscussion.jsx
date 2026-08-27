import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  PhoneOff,
  MessageSquare,
  Users,
  Clock3,
  Radio,
  Send,
  Sparkles,
  Hand,
  Volume2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  CalendarDays,
  ArrowRight
} from "lucide-react";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import SectionTitle from "../../components/SectionTitle";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
];

export default function CandidateGroupDiscussion() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const discussionIdParam = searchParams.get("discussion");

  const [discussions, setDiscussions] = useState([]);
  const [discussion, setDiscussion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [toast, setToast] = useState("");

  // Media
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // Real-time State
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [onlineParticipants, setOnlineParticipants] = useState({});
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [remainingTime, setRemainingTime] = useState("");

  const channelRef = useRef(null);
  const candidateName = profile?.full_name || "Candidate";
  const candidateId = user?.id;

  // 1. Fetch available discussions for this candidate
  const loadDiscussions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/group-discussions");
      const list = Array.isArray(res) ? res : (res?.data || []);
      setDiscussions(list);

      let targetDisc = null;
      if (discussionIdParam) {
        targetDisc = list.find(d => d.id === discussionIdParam);
      }
      if (!targetDisc && list.length > 0) {
        // Pick first live or scheduled discussion
        targetDisc = list.find(d => d.status === "live") || list[0];
      }

      if (targetDisc) {
        // Fetch complete detail
        const detRes = await api.get(`/group-discussions/${targetDisc.id}`);
        const det = detRes?.data || detRes || targetDisc;
        setDiscussion(det);
        setCurrentSpeaker(det.current_speaker || null);

        // Load messages
        try {
          const msgRes = await api.get(`/group-discussions/${targetDisc.id}/messages`);
          setMessages(Array.isArray(msgRes) ? msgRes : (msgRes?.data || []));
        } catch {}

        // Notify backend of join
        try {
          await api.post(`/group-discussions/${targetDisc.id}/join`);
        } catch {}
      }
    } catch {
      setToast("Failed to load group discussion.");
    } finally {
      setLoading(false);
    }
  }, [discussionIdParam]);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  // 2. Initialize Camera and Microphone Media Stream
  useEffect(() => {
    let stream = null;
    async function initMedia() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Camera/Mic access denied or unavailable:", err);
      }
    }

    if (discussion) {
      initMedia();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [discussion]);

  function toggleMic() {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const nextState = !mic;
      audioTracks.forEach(t => { t.enabled = nextState; });
      setMic(nextState);

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "participant_media",
          payload: { user_id: candidateId, mic: nextState, camera }
        });
      }
    } else {
      setMic(prev => !prev);
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const nextState = !camera;
      videoTracks.forEach(t => { t.enabled = nextState; });
      setCamera(nextState);

      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "participant_media",
          payload: { user_id: candidateId, mic, camera: nextState }
        });
      }
    } else {
      setCamera(prev => !prev);
    }
  }

  function toggleRaiseHand() {
    const next = !handRaised;
    setHandRaised(next);
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "hand_raised",
        payload: { user_id: candidateId, name: candidateName, raised: next }
      });
    }
    setToast(next ? "Hand raised. The moderator has been notified." : "Hand lowered.");
  }

  // 3. Supabase Real-Time Broadcast & Presence Channel
  useEffect(() => {
    if (!discussion) return;
    const roomId = discussion.meeting_room_id || discussion.id;
    const channelName = `gd_room:${roomId}`;

    const channel = supabase?.channel(channelName, {
      config: { presence: { key: candidateId } }
    });

    channelRef.current = channel;

    channel
      ?.on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const map = {};
        Object.keys(state).forEach(key => {
          const userArr = state[key];
          if (userArr && userArr[0]) {
            map[key] = userArr[0];
          }
        });
        setOnlineParticipants(map);
        setConnected(true);
        setReconnecting(false);
      })
      ?.on("presence", { event: "join" }, ({ key, newPresences }) => {
        setOnlineParticipants(prev => ({
          ...prev,
          [key]: newPresences?.[0] || { name: "Participant" }
        }));
      })
      ?.on("presence", { event: "leave" }, ({ key }) => {
        setOnlineParticipants(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      })
      ?.on("broadcast", { event: "gd_status_changed" }, ({ payload }) => {
        if (payload?.status) {
          setDiscussion(prev => prev ? { ...prev, ...payload } : prev);
          if (payload.status === "live") setToast("Discussion is now LIVE!");
          else if (payload.status === "paused") setToast("Discussion is PAUSED by moderator.");
          else if (payload.status === "completed") setToast("Discussion has CONCLUDED.");
        }
      })
      ?.on("broadcast", { event: "topic_changed" }, ({ payload }) => {
        if (payload?.topic) {
          setDiscussion(prev => prev ? { ...prev, topic: payload.topic } : prev);
          setToast(`Topic updated: "${payload.topic}"`);
        }
      })
      ?.on("broadcast", { event: "speaker_changed" }, ({ payload }) => {
        setCurrentSpeaker(payload?.speaker || null);
        if (payload?.speaker?.id === candidateId) {
          setToast("🎤 YOU HAVE THE FLOOR TO SPEAK!");
        }
      })
      ?.on("broadcast", { event: "participant_media" }, ({ payload }) => {
        if (payload?.user_id) {
          setOnlineParticipants(prev => ({
            ...prev,
            [payload.user_id]: { ...(prev[payload.user_id] || {}), ...payload }
          }));
        }
      })
      ?.on("broadcast", { event: "chat_message" }, ({ payload }) => {
        if (payload?.id) {
          setMessages(prev => prev.some(m => m.id === payload.id) ? prev : [...prev, payload]);
        }
      })
      ?.subscribe(status => {
        if (status === "SUBSCRIBED") {
          channel.track({
            name: candidateName,
            avatar_url: profile?.avatar_url,
            mic,
            camera,
            role: "candidate",
            joined_at: new Date().toISOString()
          });
          setConnected(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setConnected(false);
          setReconnecting(true);
        }
      });

    return () => {
      if (channel) {
        channel.untrack().catch(() => {});
        supabase?.removeChannel(channel);
      }
      channelRef.current = null;
    };
  }, [discussion, candidateId, candidateName, profile?.avatar_url, mic, camera]);

  // 4. Synchronized Server Countdown Timer
  useEffect(() => {
    if (!discussion || discussion.status !== "live" || !discussion.started_at) {
      setRemainingTime(discussion?.status === "completed" ? "00:00" : `${discussion?.duration_minutes || 30}:00`);
      return;
    }

    const durationSec = (discussion.duration_minutes || 30) * 60;
    const startMs = new Date(discussion.started_at).getTime();

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
      const leftSec = Math.max(0, durationSec - elapsedSec);

      const m = Math.floor(leftSec / 60);
      const s = leftSec % 60;
      setRemainingTime(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);

      if (leftSec <= 0) {
        setDiscussion(prev => prev ? { ...prev, status: "completed" } : prev);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [discussion]);

  // 5. Send Chat Message
  async function sendMessage(e) {
    e?.preventDefault();
    const text = msgText.trim();
    if (!text || !discussion) return;

    const newMsg = {
      id: `${Date.now()}-${Math.random()}`,
      discussion_id: discussion.id,
      sender_id: candidateId,
      sender_name: candidateName,
      message: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    setMsgText("");

    // Broadcast instantly to all participants
    channelRef.current?.send({
      type: "broadcast",
      event: "chat_message",
      payload: newMsg
    });

    // Save persistently to database
    try {
      await api.post(`/group-discussions/${discussion.id}/messages`, { message: text });
    } catch {}
  }

  // 6. Leave Discussion
  async function handleLeave() {
    if (discussion) {
      try {
        await api.post(`/group-discussions/${discussion.id}/leave`);
      } catch {}
    }
    navigate("/candidate/interviews");
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--maroon)", margin: "0 auto 12px" }} />
        <h3>Connecting to Live Group Discussion...</h3>
        <p className="muted">Synchronizing room participants and audio session.</p>
      </div>
    );
  }

  if (!discussion && discussions.length === 0) {
    return (
      <div>
        <SectionTitle
          eyebrow="GROUP DISCUSSION"
          title="Group Discussions"
          description="View and participate in live multi-candidate assessment rounds."
        />
        <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "20px auto" }}>
          <Users size={48} style={{ color: "var(--muted)", margin: "0 auto 12px" }} />
          <h3>No Group Discussions Scheduled</h3>
          <p className="muted">You do not have any active or upcoming group discussion rounds at this moment.</p>
          <Link to="/candidate/interviews" className="btn btn-outline" style={{ marginTop: "16px" }}>
            View My Interviews
          </Link>
        </div>
      </div>
    );
  }

  const isUserSpeaking = currentSpeaker?.id === candidateId;
  const members = discussion?.members || [];

  return (
    <div className="gd-live-container">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* Top Header Bar */}
      <header className="gd-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span className="live-pill" style={{ background: discussion?.status === "live" ? "#ef4444" : "var(--maroon)" }}>
              <span className="live-dot" /> {discussion?.status?.toUpperCase() || "SCHEDULED"}
            </span>
            <h1 style={{ margin: 0, fontSize: "20px" }}>{discussion?.title || "Group Discussion Round"}</h1>
          </div>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "12px" }}>
            {discussion?.jobs?.title || "Position Assessment"} · Room: {discussion?.meeting_room_id || discussion?.id}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="live-status">
            <Clock3 size={15} /> Remaining: {remainingTime}
          </div>
          <div className="live-status">
            <Radio size={15} style={{ color: connected ? "#22c55e" : reconnecting ? "#eab308" : "#ef4444" }} />
            {connected ? "Connected" : reconnecting ? "Reconnecting..." : "Connecting"}
          </div>
        </div>
      </header>

      {/* Topic Banner */}
      <div className="card" style={{ background: "linear-gradient(135deg, #1C1917, #292524)", color: "#fff", padding: "16px 20px", borderRadius: "14px", marginBottom: "18px", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "0.1em", color: "var(--maroon-light, #E0A899)", textTransform: "uppercase" }}>
              DISCUSSION TOPIC
            </span>
            <h2 style={{ margin: "4px 0 0", fontSize: "17px", color: "#fff", lineHeight: "1.4" }}>
              "{discussion?.topic || "Architecture & Problem Solving Strategies"}"
            </h2>
          </div>
          <Badge tone={discussion?.status === "live" ? "danger" : "info"}>
            {Object.keys(onlineParticipants).length + 1} Active Now
          </Badge>
        </div>
      </div>

      {/* Floor / Current Speaker Alert Banner */}
      <div
        style={{
          padding: "12px 18px",
          borderRadius: "12px",
          marginBottom: "18px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: isUserSpeaking ? "#DCFCE7" : currentSpeaker ? "#FEF3C7" : "#F3F4F6",
          border: isUserSpeaking ? "2px solid #22c55e" : currentSpeaker ? "1.5px solid #f59e0b" : "1px solid var(--line)"
        }}
      >
        <Volume2 size={20} color={isUserSpeaking ? "#16a34a" : currentSpeaker ? "#d97706" : "var(--muted)"} />
        <div>
          {isUserSpeaking ? (
            <div>
              <b style={{ color: "#15803d", fontSize: "14px" }}>🎤 YOU HAVE THE FLOOR TO SPEAK</b>
              <p style={{ margin: "2px 0 0", color: "#166534", fontSize: "12px" }}>
                The moderator has granted you speaking turn. Speak clearly and present your perspective.
              </p>
            </div>
          ) : currentSpeaker ? (
            <div>
              <b style={{ color: "#b45309", fontSize: "14px" }}>
                CURRENT SPEAKER: {currentSpeaker.full_name || "Participant"}
              </b>
              <p style={{ margin: "2px 0 0", color: "#92400e", fontSize: "12px" }}>
                Please listen actively. You can click 'Raise Hand' below to request the next speaking turn.
              </p>
            </div>
          ) : (
            <div>
              <b style={{ color: "var(--ink)", fontSize: "13px" }}>Floor is Open for Discussion</b>
              <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "11px" }}>
                Click 'Raise Hand' or unmute to contribute your thoughts on the topic.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Participant Video Grid + Side Chat */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "18px" }}>
        
        {/* Left Column: Participant Cards & Local Video */}
        <section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
            
            {/* Local Candidate Card (You) */}
            <div
              className="card"
              style={{
                padding: "14px",
                borderRadius: "14px",
                background: isUserSpeaking ? "#FAFDF8" : "#fff",
                border: isUserSpeaking ? "2.5px solid #22c55e" : "1.5px solid var(--line)",
                position: "relative",
                overflow: "hidden"
              }}
            >
              <div style={{ position: "relative", height: "130px", background: "#1C1917", borderRadius: "10px", overflow: "hidden", marginBottom: "10px", display: "grid", placeItems: "center" }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: camera ? "block" : "none" }}
                />
                {!camera && (
                  <div style={{ textAlign: "center", color: "#9ca3af" }}>
                    <CameraOff size={28} />
                    <p style={{ margin: "4px 0 0", fontSize: "11px" }}>Camera Off</p>
                  </div>
                )}
                <span style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "700" }}>
                  YOU (CANDIDATE)
                </span>
                {isUserSpeaking && (
                  <span style={{ position: "absolute", top: "8px", right: "8px", background: "#16a34a", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span className="live-dot" style={{ background: "#fff" }} /> SPEAKING
                  </span>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <b style={{ fontSize: "13px", display: "block" }}>{candidateName}</b>
                  <small style={{ color: "var(--muted)", fontSize: "11px" }}>{mic ? "Mic On" : "Muted"}</small>
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={{ padding: "4px", borderRadius: "50%", background: mic ? "#DCFCE7" : "#FEE2E2", color: mic ? "#16a34a" : "#ef4444", display: "grid", placeItems: "center" }}>
                    {mic ? <Mic size={13} /> : <MicOff size={13} />}
                  </span>
                </div>
              </div>
            </div>

            {/* Other Members / Candidates */}
            {members
              .filter(m => m.candidate_id !== candidateId)
              .map((m, idx) => {
                const isOnline = Boolean(onlineParticipants[m.candidate_id]);
                const isSpeaking = currentSpeaker?.id === m.candidate_id;
                const photo = m.avatar_url || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];

                return (
                  <div
                    key={m.candidate_id || idx}
                    className="card"
                    style={{
                      padding: "14px",
                      borderRadius: "14px",
                      background: isSpeaking ? "#FAFDF8" : "#fff",
                      border: isSpeaking ? "2.5px solid #22c55e" : "1px solid var(--line)",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                  >
                    <div style={{ position: "relative", height: "130px", background: "linear-gradient(135deg, #1f1b1a, #2b2220)", borderRadius: "10px", overflow: "hidden", marginBottom: "10px", display: "grid", placeItems: "center" }}>
                      <div style={{ width: "52px", height: "52px", borderRadius: "50%", overflow: "hidden", border: isSpeaking ? "3px solid #22c55e" : "2px solid rgba(255,255,255,0.2)" }}>
                        <img src={photo} alt={m.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>

                      {isSpeaking && (
                        <span style={{ position: "absolute", top: "8px", right: "8px", background: "#16a34a", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                          <span className="live-dot" style={{ background: "#fff" }} /> SPEAKING
                        </span>
                      )}

                      {/* Audio visualizer bars when speaking */}
                      {isSpeaking && (
                        <div style={{ position: "absolute", bottom: "8px", display: "flex", gap: "3px" }}>
                          {[14, 28, 42, 24, 38, 18, 30].map((h, i) => (
                            <span key={i} style={{ width: "3px", height: `${h}px`, background: "#22c55e", borderRadius: "2px" }} />
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <b style={{ fontSize: "13px", display: "block" }}>{m.full_name || "Candidate"}</b>
                        <small style={{ color: isOnline ? "#16a34a" : "var(--muted)", fontSize: "11px", fontWeight: isOnline ? "700" : "normal" }}>
                          {isOnline ? "● Online" : "Offline"}
                        </small>
                      </div>
                      <Badge tone={isSpeaking ? "success" : isOnline ? "info" : "neutral"}>
                        {isSpeaking ? "Speaking" : isOnline ? "Connected" : "Invited"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Controls Bar */}
          <div className="live-controls" style={{ marginTop: "12px", background: "#fff", border: "1px solid var(--line)", padding: "12px 20px", borderRadius: "14px", display: "flex", justifyContent: "center", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
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
              onClick={toggleRaiseHand}
              className="round-control"
              style={{ background: handRaised ? "#f59e0b" : undefined, color: handRaised ? "#fff" : undefined }}
              title={handRaised ? "Lower Hand" : "Raise Hand to Speak"}
              type="button"
            >
              <Hand size={18} />
            </button>

            <button
              onClick={handleLeave}
              className="end-call"
              style={{ padding: "8px 16px", borderRadius: "8px", background: "#ef4444", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", cursor: "pointer" }}
              type="button"
            >
              <PhoneOff size={18} /> Leave GD
            </button>
          </div>
        </section>

        {/* Right Column: Live GD Chat Box */}
        <aside>
          <section className="chat-box" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "16px" }}>
            <div className="chat-box-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <MessageSquare size={16} /> GD Room Chat
                </h3>
                <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "11px" }}>Shared with moderator and candidates</p>
              </div>
              <Badge tone="danger"><span className="live-dot" /> LIVE</Badge>
            </div>

            <div className="chat-messages" style={{ height: "340px", overflowY: "auto", background: "#FAF6F3", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {!messages.length && (
                <p className="chat-placeholder" style={{ textAlign: "center", color: "var(--muted)", fontSize: "12px", margin: "auto 0" }}>
                  No messages yet. Send a message or question to the room.
                </p>
              )}
              {messages.map(m => {
                const isMine = m.sender_id === candidateId;
                return (
                  <div
                    key={m.id}
                    className={`chat-message ${isMine ? "mine" : ""}`}
                    style={{
                      alignSelf: isMine ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      background: isMine ? "#F4E8E2" : "#fff",
                      border: `1px solid ${isMine ? "#E0CBC1" : "var(--line)"}`,
                      padding: "8px 12px",
                      borderRadius: "10px"
                    }}
                  >
                    <span style={{ fontSize: "10px", fontWeight: "800", color: "var(--maroon)", display: "block" }}>
                      {isMine ? "You" : m.sender_name || "Candidate"}
                    </span>
                    <p style={{ margin: "3px 0", fontSize: "12px", color: "var(--ink)", lineHeight: "1.4" }}>
                      {m.message}
                    </p>
                    <time style={{ fontSize: "9px", color: "var(--muted)", display: "block", textAlign: "right" }}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </time>
                  </div>
                );
              })}
            </div>

            <form onSubmit={sendMessage} style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Type a message to the group..."
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--line)",
                  fontSize: "12px",
                  background: "#FAF5F2",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "8px 14px", borderRadius: "8px", background: "var(--maroon)" }}
              >
                <Send size={15} />
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
