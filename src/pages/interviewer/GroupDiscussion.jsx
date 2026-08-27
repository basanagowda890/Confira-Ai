import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  MessageCircle,
  Mic,
  MicOff,
  Users,
  Video,
  VideoOff,
  Volume2,
  Play,
  Pause,
  StopCircle,
  Plus,
  Edit3,
  Clock3,
  Radio,
  Send,
  Sparkles,
  Hand,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Award
} from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import Toast from "../../components/Toast";
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

const PRESET_TOPICS = [
  "Is Artificial Intelligence good or bad for the future of engineering?",
  "Monolithic vs Microservices: Architectural trade-offs in modern applications.",
  "Remote Work vs In-Office: Impact on team productivity and engineering culture.",
  "The Ethics of Data Privacy and AI Automated Surveillance in tech platforms.",
  "Cloud Native vs On-Premise infrastructure for mission-critical services.",
  "Agile Methodology: Is Scrum still relevant for high-velocity teams?"
];

export default function GroupDiscussion() {
  const { user, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const discIdParam = searchParams.get("discussion");

  const [discussions, setDiscussions] = useState([]);
  const [selectedDiscussion, setSelectedDiscussion] = useState(null);
  const [candidatesList, setCandidatesList] = useState([]);
  const [jobsList, setJobsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [newTopicText, setNewTopicText] = useState("");

  // New GD Form
  const [formTitle, setFormTitle] = useState("Technical Group Discussion");
  const [formTopic, setFormTopic] = useState(PRESET_TOPICS[0]);
  const [formJobId, setFormJobId] = useState("");
  const [formDuration, setFormDuration] = useState("30");
  const [formSelectedCandidates, setFormSelectedCandidates] = useState([]);
  const [creating, setCreating] = useState(false);

  // Real-time Session State
  const [connected, setConnected] = useState(false);
  const [onlineParticipants, setOnlineParticipants] = useState({});
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [remainingTime, setRemainingTime] = useState("");
  const [activityEvents, setActivityEvents] = useState([]);
  const [speakingTurns, setSpeakingTurns] = useState({}); // { [candidate_id]: turnsCount }

  // Media
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const channelRef = useRef(null);

  const interviewerName = profile?.full_name || "Interviewer (Moderator)";
  const interviewerId = user?.id;

  // 1. Load Initial Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [discRes, candRes, jobsRes] = await Promise.allSettled([
        api.get("/group-discussions"),
        api.get("/profiles/candidates"),
        api.get("/jobs"),
      ]);

      const dList = discRes.status === "fulfilled" ? (Array.isArray(discRes.value) ? discRes.value : (discRes.value?.data || [])) : [];
      const cList = candRes.status === "fulfilled" ? (Array.isArray(candRes.value) ? candRes.value : (candRes.value?.data || [])) : [];
      const jList = jobsRes.status === "fulfilled" ? (Array.isArray(jobsRes.value) ? jobsRes.value : (jobsRes.value?.data || [])) : [];

      setDiscussions(dList);
      setCandidatesList(cList);
      setJobsList(jList);

      let targetDisc = null;
      if (discIdParam) {
        targetDisc = dList.find(d => d.id === discIdParam);
      }
      if (!targetDisc && dList.length > 0) {
        targetDisc = dList.find(d => d.status === "live") || dList[0];
      }

      if (targetDisc) {
        // Fetch full discussion details
        const detRes = await api.get(`/group-discussions/${targetDisc.id}`);
        const det = detRes?.data || detRes || targetDisc;
        setSelectedDiscussion(det);
        setCurrentSpeaker(det.current_speaker || null);

        // Fetch messages
        try {
          const msgRes = await api.get(`/group-discussions/${targetDisc.id}/messages`);
          setMessages(Array.isArray(msgRes) ? msgRes : (msgRes?.data || []));
        } catch {}
      }
    } catch {
      setToast("Failed to load group discussions.");
    } finally {
      setLoading(false);
    }
  }, [discIdParam]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Local Media
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
        console.warn("Camera/Mic access unavailable:", err);
      }
    }

    if (selectedDiscussion) {
      initMedia();
    }

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [selectedDiscussion]);

  function toggleMic() {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const next = !mic;
      audioTracks.forEach(t => { t.enabled = next; });
      setMic(next);
    } else {
      setMic(prev => !prev);
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const next = !camera;
      videoTracks.forEach(t => { t.enabled = next; });
      setCamera(next);
    } else {
      setCamera(prev => !prev);
    }
  }

  // 3. Supabase Real-Time Broadcast & Presence Channel
  useEffect(() => {
    if (!selectedDiscussion) return;
    const roomId = selectedDiscussion.meeting_room_id || selectedDiscussion.id;
    const channelName = `gd_room:${roomId}`;

    const channel = supabase?.channel(channelName, {
      config: { presence: { key: interviewerId } }
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
      })
      ?.on("presence", { event: "join" }, ({ key, newPresences }) => {
        const p = newPresences?.[0];
        if (p?.name) {
          addActivity(`${p.name} joined the discussion.`);
        }
        setOnlineParticipants(prev => ({ ...prev, [key]: p || { name: "Participant" } }));
      })
      ?.on("presence", { event: "leave" }, ({ key }) => {
        const leaving = onlineParticipants[key];
        if (leaving?.name) {
          addActivity(`${leaving.name} left the discussion.`);
        }
        setOnlineParticipants(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      })
      ?.on("broadcast", { event: "hand_raised" }, ({ payload }) => {
        if (payload?.name) {
          setToast(`✋ ${payload.name} raised hand to speak!`);
          addActivity(`${payload.name} raised hand to speak.`);
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
            name: interviewerName,
            role: "interviewer",
            avatar_url: profile?.avatar_url,
            mic,
            camera,
            joined_at: new Date().toISOString()
          });
          setConnected(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setConnected(false);
        }
      });

    return () => {
      if (channel) {
        channel.untrack().catch(() => {});
        supabase?.removeChannel(channel);
      }
      channelRef.current = null;
    };
  }, [selectedDiscussion, interviewerId, interviewerName, profile?.avatar_url, mic, camera]);

  function addActivity(text) {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setActivityEvents(prev => [{ time, text }, ...prev.slice(0, 20)]);
  }

  // 4. Synchronized Server Timer
  useEffect(() => {
    if (!selectedDiscussion || selectedDiscussion.status !== "live" || !selectedDiscussion.started_at) {
      setRemainingTime(selectedDiscussion?.status === "completed" ? "00:00" : `${selectedDiscussion?.duration_minutes || 30}:00`);
      return;
    }

    const durationSec = (selectedDiscussion.duration_minutes || 30) * 60;
    const startMs = new Date(selectedDiscussion.started_at).getTime();

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
      const leftSec = Math.max(0, durationSec - elapsedSec);

      const m = Math.floor(leftSec / 60);
      const s = leftSec % 60;
      setRemainingTime(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);

      if (leftSec <= 0) {
        handleStatusChange("completed");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedDiscussion]);

  // 5. Discussion Moderator Actions
  async function handleStatusChange(newStatus) {
    if (!selectedDiscussion) return;
    try {
      const res = await api.patch(`/group-discussions/${selectedDiscussion.id}/status`, { status: newStatus });
      const updated = res?.data || res;
      setSelectedDiscussion(prev => ({ ...prev, ...updated }));
      setDiscussions(prev => prev.map(d => d.id === selectedDiscussion.id ? { ...d, ...updated } : d));

      // Broadcast immediately to all connected candidates
      channelRef.current?.send({
        type: "broadcast",
        event: "gd_status_changed",
        payload: updated
      });

      addActivity(`Moderator changed status to ${newStatus.toUpperCase()}`);
      setToast(`Discussion status updated to ${newStatus.toUpperCase()}`);
    } catch (err) {
      setToast(err?.message || "Failed to update discussion status.");
    }
  }

  async function handleSpeakerChange(candidate) {
    if (!selectedDiscussion) return;
    try {
      const speakerId = candidate ? candidate.candidate_id : null;
      await api.patch(`/group-discussions/${selectedDiscussion.id}/speaker`, { speaker_id: speakerId });

      const speakerObj = candidate ? {
        id: candidate.candidate_id,
        full_name: candidate.full_name,
        avatar_url: candidate.avatar_url
      } : null;

      setCurrentSpeaker(speakerObj);

      if (candidate) {
        setSpeakingTurns(prev => ({
          ...prev,
          [candidate.candidate_id]: (prev[candidate.candidate_id] || 0) + 1
        }));
      }

      // Broadcast immediately to all participants
      channelRef.current?.send({
        type: "broadcast",
        event: "speaker_changed",
        payload: { speaker: speakerObj }
      });

      addActivity(candidate ? `Speaking turn given to ${candidate.full_name}` : "Speaking floor opened for all.");
      setToast(candidate ? `Speaking turn given to ${candidate.full_name}` : "Floor is now open.");
    } catch {
      setToast("Failed to update speaker.");
    }
  }

  async function handleTopicSave() {
    if (!selectedDiscussion || !newTopicText.trim()) return;
    try {
      const res = await api.patch(`/group-discussions/${selectedDiscussion.id}/topic`, { topic: newTopicText.trim() });
      const updated = res?.data || res;
      setSelectedDiscussion(prev => ({ ...prev, topic: updated.topic }));

      // Broadcast to all participants
      channelRef.current?.send({
        type: "broadcast",
        event: "topic_changed",
        payload: { topic: updated.topic }
      });

      setShowTopicModal(false);
      addActivity(`Topic changed to: "${updated.topic}"`);
      setToast("Topic updated successfully!");
    } catch {
      setToast("Failed to update topic.");
    }
  }

  // 6. Create New GD
  async function handleCreateGD(e) {
    e.preventDefault();
    if (!formTitle.trim() || !formTopic.trim()) {
      setToast("Title and topic are required.");
      return;
    }

    try {
      setCreating(true);
      const res = await api.post("/group-discussions", {
        title: formTitle.trim(),
        topic: formTopic.trim(),
        job_id: formJobId || null,
        duration_minutes: parseInt(formDuration, 10) || 30,
        candidate_ids: formSelectedCandidates
      });

      const newDisc = res?.data || res;
      setDiscussions(prev => [newDisc, ...prev]);
      setSelectedDiscussion(newDisc);
      setShowCreateModal(false);
      setToast("Group Discussion created successfully!");
      setSearchParams({ discussion: newDisc.id });
    } catch {
      setToast("Failed to create group discussion.");
    } finally {
      setCreating(false);
    }
  }

  // 7. Send Chat Message
  async function sendMessage(e) {
    e?.preventDefault();
    const text = msgText.trim();
    if (!text || !selectedDiscussion) return;

    const newMsg = {
      id: `${Date.now()}-${Math.random()}`,
      discussion_id: selectedDiscussion.id,
      sender_id: interviewerId,
      sender_name: interviewerName,
      message: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    setMsgText("");

    // Broadcast instantly
    channelRef.current?.send({
      type: "broadcast",
      event: "chat_message",
      payload: newMsg
    });

    try {
      await api.post(`/group-discussions/${selectedDiscussion.id}/messages`, { message: text });
    } catch {}
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: "40px", textAlign: "center", maxWidth: "600px", margin: "40px auto" }}>
        <Loader2 size={32} className="spin" style={{ color: "var(--maroon)", margin: "0 auto 12px" }} />
        <h3>Loading Group Discussion Cockpit...</h3>
        <p className="muted">Synchronizing live multi-candidate rooms.</p>
      </div>
    );
  }

  const members = selectedDiscussion?.members || [];
  const totalTurns = Object.values(speakingTurns).reduce((a, b) => a + b, 0);

  return (
    <div className="gd-container">
      <Toast message={toast} onClose={() => setToast("")} />

      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--maroon)", fontWeight: "800", fontSize: "11px", letterSpacing: "0.1em" }}>
            LIVE GROUP DISCUSSION & MULTI-CANDIDATE ASSESSMENT
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "22px" }}>{selectedDiscussion?.title || "Group Discussion Session"}</h1>
            {selectedDiscussion && (
              <Badge tone={selectedDiscussion.status === "live" ? "danger" : selectedDiscussion.status === "completed" ? "success" : "info"}>
                <span className="live-dot" style={{ background: selectedDiscussion.status === "live" ? "#ef4444" : "#16a34a" }} />
                {selectedDiscussion.status.toUpperCase()}
              </Badge>
            )}

            {/* Discussion Switcher */}
            {discussions.length > 1 && (
              <select
                value={selectedDiscussion?.id || ""}
                onChange={e => {
                  const found = discussions.find(d => d.id === e.target.value);
                  if (found) {
                    setSelectedDiscussion(found);
                    setSearchParams({ discussion: found.id });
                  }
                }}
                style={{
                  padding: "5px 10px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--line)",
                  fontSize: "12px",
                  fontWeight: "600",
                  background: "#FAF5F2",
                  outline: "none"
                }}
              >
                {discussions.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.status.toUpperCase()})
                  </option>
                ))}
              </select>
            )}
          </div>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "12px" }}>
            {selectedDiscussion?.jobs?.title || "General Round"} · Room: {selectedDiscussion?.meeting_room_id || selectedDiscussion?.id || "N/A"}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button className="btn btn-outline" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} /> Schedule New GD
          </button>

          {/* Moderator Status Controls */}
          {selectedDiscussion?.status === "scheduled" && (
            <button
              className="btn btn-primary"
              onClick={() => handleStatusChange("live")}
              style={{ background: "#16a34a", borderColor: "#16a34a" }}
            >
              <Play size={15} /> Start Discussion
            </button>
          )}

          {selectedDiscussion?.status === "live" && (
            <>
              <button
                className="btn btn-outline"
                onClick={() => handleStatusChange("paused")}
                style={{ borderColor: "#f59e0b", color: "#d97706" }}
              >
                <Pause size={15} /> Pause
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setShowEndModal(true)}
                style={{ background: "#ef4444" }}
              >
                <StopCircle size={15} /> End GD
              </button>
            </>
          )}

          {selectedDiscussion?.status === "paused" && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => handleStatusChange("live")}
                style={{ background: "#16a34a", borderColor: "#16a34a" }}
              >
                <Play size={15} /> Resume GD
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setShowEndModal(true)}
                style={{ background: "#ef4444" }}
              >
                <StopCircle size={15} /> End GD
              </button>
            </>
          )}
        </div>
      </div>

      {/* Topic Card with Live Edit button */}
      <div className="card" style={{ background: "linear-gradient(135deg, #1c1917, #292524)", color: "#fff", padding: "16px 20px", borderRadius: "14px", marginBottom: "18px", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <span style={{ fontSize: "11px", fontWeight: "800", color: "#E0A899", letterSpacing: "0.1em" }}>
              CURRENT TOPIC
            </span>
            <h2 style={{ margin: "4px 0 0", fontSize: "16px", color: "#fff" }}>
              "{selectedDiscussion?.topic || "Architecture & Problem Solving Strategies"}"
            </h2>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "rgba(255,255,255,0.1)", padding: "6px 12px", borderRadius: "8px", fontSize: "12px" }}>
              <Clock3 size={14} /> Timer: <b>{remainingTime}</b>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setNewTopicText(selectedDiscussion?.topic || "");
                setShowTopicModal(true);
              }}
              style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}
            >
              <Edit3 size={13} /> Edit Topic
            </button>
          </div>
        </div>
      </div>

      {/* Floor / Current Speaker Control Bar */}
      <div className="card" style={{ padding: "12px 18px", borderRadius: "12px", marginBottom: "18px", background: "#FAF5F2", border: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Volume2 size={18} color="var(--maroon)" />
          <div>
            <b style={{ fontSize: "13px" }}>
              Current Speaker: {currentSpeaker ? currentSpeaker.full_name : "Floor Open (No Active Speaker)"}
            </b>
            <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "11px" }}>
              {currentSpeaker ? "Click 'Release Floor' to open speaking turn to other candidates." : "Select any candidate below to grant speaking turn."}
            </p>
          </div>
        </div>

        {currentSpeaker && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => handleSpeakerChange(null)}
            style={{ fontWeight: "700" }}
          >
            Release Floor / Mute Speaker
          </button>
        )}
      </div>

      {/* Main Grid: Candidate Video Stage + Side Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: "18px" }}>
        
        {/* Left Column: Live Multi-Candidate Stage */}
        <section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px", marginBottom: "16px" }}>
            
            {/* Moderator Preview Card */}
            <div className="card" style={{ padding: "14px", borderRadius: "14px", border: "1.5px solid var(--line)" }}>
              <div style={{ position: "relative", height: "130px", background: "#1c1917", borderRadius: "10px", overflow: "hidden", display: "grid", placeItems: "center", marginBottom: "10px" }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: camera ? "block" : "none" }}
                />
                {!camera && (
                  <div style={{ textAlign: "center", color: "#9ca3af" }}>
                    <VideoOff size={28} />
                    <p style={{ margin: "4px 0 0", fontSize: "11px" }}>Camera Off</p>
                  </div>
                )}
                <span style={{ position: "absolute", bottom: "8px", left: "8px", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800" }}>
                  YOU (MODERATOR)
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b>{interviewerName}</b>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={toggleMic} className={`btn btn-outline btn-sm ${mic ? "" : "off"}`} style={{ padding: "4px 8px" }}>
                    {mic ? <Mic size={13} /> : <MicOff size={13} color="#ef4444" />}
                  </button>
                  <button onClick={toggleCamera} className={`btn btn-outline btn-sm ${camera ? "" : "off"}`} style={{ padding: "4px 8px" }}>
                    {camera ? <Video size={13} /> : <VideoOff size={13} color="#ef4444" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Candidate Participants */}
            {members.map((m, idx) => {
              const isOnline = Boolean(onlineParticipants[m.candidate_id]);
              const isSpeaking = currentSpeaker?.id === m.candidate_id;
              const photo = m.avatar_url || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];
              const turns = speakingTurns[m.candidate_id] || 0;

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
                  <div style={{ position: "relative", height: "130px", background: "linear-gradient(135deg, #1f1b1a, #2b2220)", borderRadius: "10px", overflow: "hidden", display: "grid", placeItems: "center", marginBottom: "10px" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "50%", overflow: "hidden", border: isSpeaking ? "3px solid #22c55e" : "2px solid rgba(255,255,255,0.2)" }}>
                      <img src={photo} alt={m.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>

                    {isSpeaking && (
                      <span style={{ position: "absolute", top: "8px", right: "8px", background: "#16a34a", color: "#fff", padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" }}>
                        <span className="live-dot" style={{ background: "#fff" }} /> SPEAKING
                      </span>
                    )}

                    {/* Audio visualizer */}
                    {isSpeaking && (
                      <div style={{ position: "absolute", bottom: "8px", display: "flex", gap: "3px" }}>
                        {[14, 28, 42, 24, 38, 18, 30].map((h, i) => (
                          <span key={i} style={{ width: "3px", height: `${h}px`, background: "#22c55e", borderRadius: "2px" }} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <div>
                        <b style={{ fontSize: "13px", display: "block" }}>{m.full_name || "Candidate"}</b>
                        <small style={{ color: isOnline ? "#16a34a" : "var(--muted)", fontSize: "11px", fontWeight: isOnline ? "700" : "normal" }}>
                          {isOnline ? "● Online" : "Offline"}
                        </small>
                      </div>
                      <span style={{ fontSize: "10px", color: "var(--muted)", fontWeight: "600" }}>
                        {turns} turns
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => isSpeaking ? handleSpeakerChange(null) : handleSpeakerChange(m)}
                      className={`btn ${isSpeaking ? "btn-outline" : "btn-primary"} btn-sm`}
                      style={{ width: "100%", padding: "5px 0", fontSize: "11px", background: isSpeaking ? undefined : "var(--maroon)" }}
                    >
                      {isSpeaking ? "Revoke Turn" : "Give Turn to Speak →"}
                    </button>
                  </div>
                </div>
              );
            })}

            {!members.length && (
              <div className="card" style={{ gridColumn: "1 / -1", padding: "30px", textAlign: "center" }}>
                <Users size={32} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
                <h4>No Candidates Assigned</h4>
                <p className="muted" style={{ fontSize: "12px" }}>Schedule or edit this GD to invite candidates.</p>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Live Chat & Metrics */}
        <aside style={{ display: "grid", gap: "16px" }}>
          
          {/* Realtime GD Chat Box */}
          <section className="chat-box" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "14px", padding: "16px" }}>
            <div className="chat-box-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <MessageCircle size={15} /> Room Chat & Notes
                </h3>
                <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: "10px" }}>Live messages with candidates</p>
              </div>
              <Badge tone="danger"><span className="live-dot" /> LIVE</Badge>
            </div>

            <div className="chat-messages" style={{ height: "220px", overflowY: "auto", background: "#FAF6F3", borderRadius: "8px", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {!messages.length && (
                <p className="chat-placeholder" style={{ textAlign: "center", color: "var(--muted)", fontSize: "11px", margin: "auto 0" }}>
                  No messages yet.
                </p>
              )}
              {messages.map(m => {
                const isMine = m.sender_id === interviewerId;
                return (
                  <div
                    key={m.id}
                    className={`chat-message ${isMine ? "mine" : ""}`}
                    style={{
                      alignSelf: isMine ? "flex-end" : "flex-start",
                      maxWidth: "88%",
                      background: isMine ? "#F4E8E2" : "#fff",
                      border: `1px solid ${isMine ? "#E0CBC1" : "var(--line)"}`,
                      padding: "6px 10px",
                      borderRadius: "8px"
                    }}
                  >
                    <span style={{ fontSize: "9px", fontWeight: "800", color: "var(--maroon)", display: "block" }}>
                      {isMine ? "You (Moderator)" : m.sender_name || "Candidate"}
                    </span>
                    <p style={{ margin: "2px 0", fontSize: "11px", color: "var(--ink)", lineHeight: "1.4" }}>
                      {m.message}
                    </p>
                    <time style={{ fontSize: "8px", color: "var(--muted)", display: "block", textAlign: "right" }}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    </time>
                  </div>
                );
              })}
            </div>

            <form onSubmit={sendMessage} style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
              <input
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Broadcast a note..."
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--line)",
                  fontSize: "11px",
                  background: "#FAF5F2",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: "7px 12px", borderRadius: "6px", background: "var(--maroon)" }}
              >
                <Send size={13} />
              </button>
            </form>
          </section>

          {/* Participation Metrics */}
          <section className="card" style={{ padding: "16px", borderRadius: "14px" }}>
            <div className="card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "13px" }}>Participation Metrics</h3>
              <Users size={16} />
            </div>

            {members.map(m => {
              const turns = speakingTurns[m.candidate_id] || 0;
              const pct = totalTurns > 0 ? Math.round((turns / totalTurns) * 100) : 0;

              return (
                <div key={m.candidate_id} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "3px" }}>
                    <b>{m.full_name}</b>
                    <span style={{ color: "var(--maroon)", fontWeight: "700" }}>{pct}% ({turns} turns)</span>
                  </div>
                  <ProgressBar value={pct} />
                </div>
              );
            })}
            {!members.length && <p className="muted" style={{ fontSize: "11px" }}>No candidate data yet.</p>}
          </section>

          {/* Activity Log */}
          <section className="card" style={{ padding: "16px", borderRadius: "14px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "13px" }}>Room Activity Feed</h3>
            <div style={{ maxHeight: "140px", overflowY: "auto", display: "grid", gap: "6px" }}>
              {activityEvents.map((e, idx) => (
                <div key={idx} style={{ fontSize: "10px", display: "flex", gap: "6px", color: "var(--muted)" }}>
                  <span style={{ fontWeight: "700", color: "var(--ink)" }}>{e.time}</span>
                  <span>{e.text}</span>
                </div>
              ))}
              {!activityEvents.length && <p className="muted" style={{ fontSize: "10px" }}>Awaiting room events...</p>}
            </div>
          </section>
        </aside>
      </div>

      {/* ── CREATE GD MODAL ─────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "520px" }}>
            <div className="modal-head">
              <h3>Schedule Group Discussion</h3>
              <button className="icon-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateGD} style={{ display: "grid", gap: "12px", marginTop: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                  Session Title
                </label>
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Frontend Engineering GD Round"
                  required
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                  Discussion Topic
                </label>
                <select
                  value={formTopic}
                  onChange={e => setFormTopic(e.target.value)}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)", marginBottom: "6px" }}
                >
                  {PRESET_TOPICS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                  <option value="custom">Custom Topic...</option>
                </select>
                {formTopic === "custom" && (
                  <input
                    placeholder="Enter custom topic..."
                    onChange={e => setFormTopic(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  />
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                    Associated Job
                  </label>
                  <select
                    value={formJobId}
                    onChange={e => setFormJobId(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  >
                    <option value="">General Assessment</option>
                    {jobsList.map(j => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                    Duration (Minutes)
                  </label>
                  <select
                    value={formDuration}
                    onChange={e => setFormDuration(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "4px" }}>
                  Invite Candidates ({formSelectedCandidates.length} Selected)
                </label>
                <div style={{ maxHeight: "140px", overflowY: "auto", border: "1px solid var(--line)", borderRadius: "8px", padding: "8px", display: "grid", gap: "6px" }}>
                  {candidatesList.map(c => {
                    const isChecked = formSelectedCandidates.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormSelectedCandidates(prev => [...prev, c.id]);
                            } else {
                              setFormSelectedCandidates(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                        />
                        <span>{c.full_name} ({c.email || "Candidate"})</span>
                      </label>
                    );
                  })}
                  {!candidatesList.length && <p className="muted" style={{ fontSize: "11px" }}>No candidate profiles found.</p>}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Schedule Discussion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT TOPIC MODAL ───────────────────────────────────────────────── */}
      {showTopicModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "450px" }}>
            <div className="modal-head">
              <h3>Update Discussion Topic</h3>
              <button className="icon-btn" onClick={() => setShowTopicModal(false)}>✕</button>
            </div>
            <div style={{ margin: "14px 0" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                New Topic
              </label>
              <textarea
                value={newTopicText}
                onChange={e => setNewTopicText(e.target.value)}
                rows={3}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "13px", boxSizing: "border-box" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button className="btn btn-outline" onClick={() => setShowTopicModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleTopicSave}>Update Topic</button>
            </div>
          </div>
        </div>
      )}

      {/* ── END DISCUSSION MODAL ───────────────────────────────────────────── */}
      {showEndModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "420px", textAlign: "center" }}>
            <StopCircle size={40} color="#ef4444" style={{ margin: "0 auto 12px" }} />
            <h3>End Group Discussion?</h3>
            <p className="muted" style={{ fontSize: "13px", margin: "6px 0 18px" }}>
              This will conclude the live round, stop speaking turns, and finalize the session timer for all participants.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              <button className="btn btn-outline" onClick={() => setShowEndModal(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                style={{ background: "#ef4444" }}
                onClick={() => {
                  setShowEndModal(false);
                  handleStatusChange("completed");
                }}
              >
                End Discussion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}