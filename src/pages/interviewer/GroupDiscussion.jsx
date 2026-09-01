import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  Award,
  Monitor,
  FileText,
  TrendingUp,
  Brain,
  ShieldCheck,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  ChevronRight,
  ChevronLeft,
  Search,
  X
} from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import Toast from "../../components/Toast";
import GDVideoTile from "../../components/GDVideoTile";
import GDScreenViewer from "../../components/GDScreenViewer";
import GDParticipantStrip from "../../components/GDParticipantStrip";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { useGDWebRTC } from "../../lib/useGDWebRTC";

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

  // Form State
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const pad = n => String(n).padStart(2, "0");
  const defaultDate = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

  const [formTitle, setFormTitle] = useState("Technical Group Discussion");
  const [formTopic, setFormTopic] = useState(PRESET_TOPICS[0]);
  const [formJobId, setFormJobId] = useState("");
  const [formDate, setFormDate] = useState(defaultDate);
  const [formTime, setFormTime] = useState("10:00");
  const [formDuration, setFormDuration] = useState("30");
  const [formSelectedCandidates, setFormSelectedCandidates] = useState([]);
  const [creating, setCreating] = useState(false);

  // Google Meet UI: Pinning & Side Drawer
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState("chat"); // "chat" | "transcripts" | "analysis" | "participants" | null
  const [participantSearch, setParticipantSearch] = useState("");

  // Real-time State
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [messages, setMessages] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [remainingTime, setRemainingTime] = useState("");
  const [activityEvents, setActivityEvents] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const interviewerName = profile?.full_name || "Interviewer (Moderator)";
  const interviewerId = user?.id;

  const addActivity = useCallback((text) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setActivityEvents(prev => [{ time, text }, ...prev.slice(0, 30)]);
  }, []);

  const handleNewTranscript = useCallback((payload) => {
    setTranscripts(prev => [...prev, payload]);
  }, []);

  // Fullscreen State & Ref
  const meetingContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fullscreen Handler
  const toggleFullscreen = useCallback(() => {
    const elem = meetingContainerRef.current || document.documentElement;
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    function onFsChange() {
      const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(isFs);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // WebRTC Mesh Hook
  const {
    localStream,
    localVideoRef,
    camera,
    mic,
    toggleCamera,
    toggleMic,
    isSharingScreen,
    screenStream,
    remoteScreen,
    startScreenShare,
    stopScreenShare,
    remoteStreams,
    presenceMap,
    connected,
    activeSpeakers,
    speakingMetrics,
    channelRef,
    cleanupMediaAndConnections,
  } = useGDWebRTC({
    discussionId: selectedDiscussion?.id,
    meetingRoomId: selectedDiscussion?.meeting_room_id || selectedDiscussion?.id,
    userId: interviewerId,
    userName: interviewerName,
    userAvatar: profile?.avatar_url,
    userRole: "interviewer",
    onToast: setToast,
    onActivity: addActivity,
    onTranscript: handleNewTranscript,
  });

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
        const detRes = await api.get(`/group-discussions/${targetDisc.id}`);
        const det = detRes?.data || detRes || targetDisc;
        setSelectedDiscussion(det);
        setCurrentSpeaker(det.current_speaker || null);

        // Load messages & transcripts & analysis
        try {
          const [msgRes, transRes, analRes] = await Promise.allSettled([
            api.get(`/group-discussions/${targetDisc.id}/messages`),
            api.get(`/group-discussions/${targetDisc.id}/transcripts`),
            api.get(`/group-discussions/${targetDisc.id}/analysis`),
          ]);
          if (msgRes.status === "fulfilled") {
            setMessages(Array.isArray(msgRes.value) ? msgRes.value : (msgRes.value?.data || []));
          }
          if (transRes.status === "fulfilled") {
            setTranscripts(Array.isArray(transRes.value) ? transRes.value : (transRes.value?.data || []));
          }
          if (analRes.status === "fulfilled" && analRes.value?.data) {
            setAiAnalysis(analRes.value.data);
          }
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

  // 2. Real-time Channel Extra Event Handlers
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    channel
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
      ?.on("broadcast", { event: "speaker_changed" }, ({ payload }) => {
        setCurrentSpeaker(payload?.speaker || null);
      });
  }, [channelRef, addActivity]);

  // 3. Synchronized Server Countdown Timer
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

      if (leftSec <= 0 && selectedDiscussion.status === "live") {
        handleStatusChange("completed");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [selectedDiscussion]);

  // 4. Moderator Actions
  async function handleStatusChange(newStatus) {
    if (!selectedDiscussion) return;
    try {
      const res = await api.patch(`/group-discussions/${selectedDiscussion.id}/status`, { status: newStatus });
      const updated = res?.data || res;
      setSelectedDiscussion(prev => ({ ...prev, ...updated }));
      setDiscussions(prev => prev.map(d => d.id === selectedDiscussion.id ? { ...d, ...updated } : d));

      channelRef.current?.send({
        type: "broadcast",
        event: "gd_status_changed",
        payload: updated
      });

      if (newStatus === "completed" || newStatus === "cancelled") {
        channelRef.current?.send({
          type: "broadcast",
          event: "gd_ended",
          payload: { discussion_id: selectedDiscussion.id }
        });
        cleanupMediaAndConnections?.();
      }

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

  async function handleCreateGD(e) {
    e.preventDefault();
    if (!formTitle.trim() || !formTopic.trim()) {
      setToast("Title and topic are required.");
      return;
    }

    try {
      setCreating(true);
      const formattedTime = formTime.length === 5 ? `${formTime}:00` : formTime;
      const dateObj = new Date(`${formDate}T${formattedTime}`);
      const scheduledIso = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();

      const res = await api.post("/group-discussions", {
        title: formTitle.trim(),
        topic: formTopic.trim(),
        job_id: formJobId || null,
        scheduled_at: scheduledIso,
        duration_minutes: parseInt(formDuration, 10) || 30,
        candidate_ids: formSelectedCandidates
      });

      const newDisc = res?.data || res;
      setDiscussions(prev => [newDisc, ...prev]);
      setSelectedDiscussion(newDisc);
      setShowCreateModal(false);
      setToast("Group Discussion scheduled successfully!");
      setSearchParams({ discussion: newDisc.id });
    } catch {
      setToast("Failed to create group discussion.");
    } finally {
      setCreating(false);
    }
  }

  async function sendMessage(e) {
    e?.preventDefault();
    const text = msgText.trim();
    if (!text || !selectedDiscussion) return;

    const newMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      discussion_id: selectedDiscussion.id,
      sender_id: interviewerId,
      sender_name: interviewerName,
      message: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, newMsg]);
    setMsgText("");

    channelRef.current?.send({
      type: "broadcast",
      event: "chat_message",
      payload: newMsg
    });

    try {
      await api.post(`/group-discussions/${selectedDiscussion.id}/messages`, { message: text });
    } catch {}
  }

  // 5. Trigger AI GD Evaluation
  async function runAIEvaluation() {
    if (!selectedDiscussion) return;
    try {
      setAnalyzing(true);
      const members = selectedDiscussion.members || [];
      const candidatePayload = members.map(m => ({
        candidate_id: m.candidate_id,
        name: m.full_name,
        speaking_turns: speakingMetrics[m.candidate_id]?.turns || 0,
        speaking_time_seconds: Math.round(speakingMetrics[m.candidate_id]?.seconds || 0),
        transcripts: transcripts.filter(t => (t.candidateId || t.candidate_id) === m.candidate_id)
      }));

      const res = await api.post(`/group-discussions/${selectedDiscussion.id}/analyze`, {
        candidates: candidatePayload
      });
      const resultData = res?.data || res;
      setAiAnalysis(resultData);
      setActiveDrawer("analysis");
      setToast("AI Group Discussion evaluation complete!");
    } catch (err) {
      setToast("Failed to run AI evaluation. " + (err?.message || ""));
    } finally {
      setAnalyzing(false);
    }
  }

  // 6. Build Unified Participant List (No 5-participant limit)
  const assignedMembers = selectedDiscussion?.members || [];
  
  const allParticipants = useMemo(() => {
    const list = [];

    // Moderator (self)
    list.push({
      userId: interviewerId,
      name: interviewerName,
      role: "interviewer",
      avatar: profile?.avatar_url,
      stream: localStream,
      isLocal: true,
      isCameraOn: camera,
      isMicOn: mic,
      isSpeaking: Boolean(activeSpeakers[interviewerId]),
      isScreenSharing: isSharingScreen,
      speakingTurns: speakingMetrics[interviewerId]?.turns || 0,
    });

    // Assigned and online candidates
    assignedMembers.forEach((m, idx) => {
      const cid = m.candidate_id;
      const presence = presenceMap[cid];
      const stream = remoteStreams[cid];
      const photo = m.avatar_url || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];

      list.push({
        userId: cid,
        name: m.full_name || "Candidate",
        role: "candidate",
        avatar: photo,
        stream: stream || null,
        isLocal: false,
        isCameraOn: presence ? presence.camera : true,
        isMicOn: presence ? presence.mic : true,
        isSpeaking: Boolean(activeSpeakers[cid] || presence?.isSpeaking),
        isScreenSharing: Boolean(presence?.is_screen_sharing),
        speakingTurns: speakingMetrics[cid]?.turns || 0,
        isCurrentSpeaker: currentSpeaker?.id === cid,
        rawMember: m
      });
    });

    // Add any extra online participants from presence not explicitly in member list
    Object.keys(presenceMap).forEach((pid) => {
      if (pid !== interviewerId && !assignedMembers.some(m => m.candidate_id === pid)) {
        const pres = presenceMap[pid];
        list.push({
          userId: pid,
          name: pres.name || "Candidate",
          role: pres.role || "candidate",
          avatar: pres.avatar_url || DEFAULT_AVATARS[0],
          stream: remoteStreams[pid] || null,
          isLocal: false,
          isCameraOn: pres.camera ?? true,
          isMicOn: pres.mic ?? true,
          isSpeaking: Boolean(activeSpeakers[pid] || pres.isSpeaking),
          isScreenSharing: Boolean(pres.is_screen_sharing),
          speakingTurns: speakingMetrics[pid]?.turns || 0,
          isCurrentSpeaker: currentSpeaker?.id === pid,
        });
      }
    });

    return list;
  }, [interviewerId, interviewerName, profile?.avatar_url, localStream, camera, mic, activeSpeakers, isSharingScreen, speakingMetrics, assignedMembers, presenceMap, remoteStreams, currentSpeaker]);

  // 7. Google Meet Main Stage Participant Resolution (Max 4-5 visible in main grid)
  const hasActiveScreenShare = Boolean(remoteScreen?.stream || screenStream);

  const mainStageParticipants = useMemo(() => {
    if (hasActiveScreenShare) {
      // When screen sharing is active, the screen is the primary content. Show 0-2 video tiles if desired.
      return [];
    }

    const selected = [];

    // Priority 1: Pinned Participant
    if (pinnedUserId) {
      const pinned = allParticipants.find(p => p.userId === pinnedUserId);
      if (pinned) selected.push(pinned);
    }

    // Priority 2: Active Speaker (if not already pinned)
    const activeSpeakerObj = allParticipants.find(
      p => p.isSpeaking && p.userId !== pinnedUserId
    );
    if (activeSpeakerObj && !selected.some(p => p.userId === activeSpeakerObj.userId)) {
      selected.push(activeSpeakerObj);
    }

    // Priority 3: Moderator (self) if room
    const mod = allParticipants.find(p => p.role === "interviewer");
    if (mod && !selected.some(p => p.userId === mod.userId) && selected.length < 4) {
      selected.push(mod);
    }

    // Priority 4: Fill remaining slots up to 4 participants max
    for (const p of allParticipants) {
      if (selected.length >= 4) break;
      if (!selected.some(s => s.userId === p.userId)) {
        selected.push(p);
      }
    }

    return selected;
  }, [hasActiveScreenShare, pinnedUserId, allParticipants]);

  const mainStageUserIds = mainStageParticipants.map(p => p.userId);

  function togglePinParticipant(targetUserId) {
    setPinnedUserId(prev => (prev === targetUserId ? null : targetUserId));
    if (pinnedUserId !== targetUserId) {
      const p = allParticipants.find(item => item.userId === targetUserId);
      setToast(p ? `📌 Pinned ${p.name} to main stage` : "Pinned participant");
    } else {
      setToast("Unpinned participant");
    }
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

  return (
    <div
      ref={meetingContainerRef}
      className={`gd-container gd-meeting-container ${isFullscreen ? "is-fullscreen" : ""}`}
      style={{ maxWidth: "1550px", margin: "0 auto" }}
    >
      <Toast message={toast} onClose={() => setToast("")} />

      {/* Top Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div className="eyebrow" style={{ color: "var(--maroon)", fontWeight: "800", fontSize: "11px", letterSpacing: "0.1em" }}>
            LIVE GROUP DISCUSSION & MULTI-CANDIDATE COCKPIT
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0", flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: "21px" }}>{selectedDiscussion?.title || "Group Discussion Session"}</h1>
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
                  padding: "4px 8px",
                  borderRadius: "8px",
                  border: "1.5px solid var(--line)",
                  fontSize: "11px",
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
            {selectedDiscussion?.jobs?.title || "General Assessment"} · Room: {selectedDiscussion?.meeting_room_id || selectedDiscussion?.id} · {allParticipants.length} Connected
          </p>
        </div>

        {/* Top Header Quick Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#FAF5F2", border: "1px solid var(--line)", padding: "5px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "700" }}>
            <Clock3 size={14} color="var(--maroon)" /> Time Left: <b>{remainingTime}</b>
          </div>

          <button className="btn btn-outline btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> Schedule New GD
          </button>

          {selectedDiscussion?.status === "scheduled" && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleStatusChange("live")}
              style={{ background: "#16a34a", borderColor: "#16a34a" }}
            >
              <Play size={14} /> Start Discussion
            </button>
          )}

          {selectedDiscussion?.status === "live" && (
            <>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => handleStatusChange("paused")}
                style={{ borderColor: "#f59e0b", color: "#d97706" }}
              >
                <Pause size={14} /> Pause
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowEndModal(true)}
                style={{ background: "#ef4444" }}
              >
                <StopCircle size={14} /> End GD
              </button>
            </>
          )}

          {selectedDiscussion?.status === "paused" && (
            <>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleStatusChange("live")}
                style={{ background: "#16a34a", borderColor: "#16a34a" }}
              >
                <Play size={14} /> Resume GD
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => setShowEndModal(true)}
                style={{ background: "#ef4444" }}
              >
                <StopCircle size={14} /> End GD
              </button>
            </>
          )}
        </div>
      </div>

      {/* Topic Card with Live Edit button */}
      <div className="card" style={{ background: "linear-gradient(135deg, #1c1917, #292524)", color: "#fff", padding: "12px 18px", borderRadius: "12px", marginBottom: "14px", border: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ flex: 1, minWidth: "240px" }}>
            <span style={{ fontSize: "10px", fontWeight: "800", color: "#E0A899", letterSpacing: "0.1em" }}>
              CURRENT GD TOPIC
            </span>
            <h2 style={{ margin: "2px 0 0", fontSize: "15px", color: "#fff", lineHeight: "1.3" }}>
              "{selectedDiscussion?.topic || "Architecture & Problem Solving Strategies"}"
            </h2>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setNewTopicText(selectedDiscussion?.topic || "");
              setShowTopicModal(true);
            }}
            style={{ color: "#fff", borderColor: "rgba(255,255,255,0.3)", padding: "4px 10px", fontSize: "11px" }}
          >
            <Edit3 size={13} /> Edit Topic
          </button>
        </div>
      </div>

      {/* Main Google Meet Grid + Slide-Out Drawer */}
      <div style={{ display: "grid", gridTemplateColumns: activeDrawer ? "minmax(0, 1fr) 360px" : "1fr", gap: "16px", transition: "all 0.3s ease" }}>
        
        {/* Left / Center: Google Meet Stage & Participant Strip */}
        <section style={{ minWidth: 0 }}>
          
          {/* 1. PRIMARY STAGE: Screen Share (if active) OR Google Meet Video Grid (1-4 participants) */}
          {hasActiveScreenShare ? (
            <GDScreenViewer
              screenStream={remoteScreen?.stream || screenStream}
              sharerName={remoteScreen?.sharerName || (isSharingScreen ? "You (Moderator)" : "Participant")}
              isLocalSharer={isSharingScreen}
              onStopShare={stopScreenShare}
            />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  mainStageParticipants.length === 1
                    ? "1fr"
                    : mainStageParticipants.length === 2
                    ? "1fr 1fr"
                    : "1fr 1fr",
                gap: "12px",
                marginBottom: "12px"
              }}
            >
              {mainStageParticipants.map((p) => {
                const isPinned = pinnedUserId === p.userId;
                const stageSize = mainStageParticipants.length === 1 ? "single" : mainStageParticipants.length === 2 ? "dual" : "grid";

                return (
                  <GDVideoTile
                    key={p.userId}
                    stream={p.stream}
                    name={p.name}
                    role={p.role}
                    avatar={p.avatar}
                    isLocal={p.isLocal}
                    isCameraOn={p.isCameraOn}
                    isMicOn={p.isMicOn}
                    isSpeaking={p.isSpeaking}
                    isCurrentSpeaker={p.isCurrentSpeaker}
                    isPinned={isPinned}
                    onTogglePin={() => togglePinParticipant(p.userId)}
                    speakingTurns={p.speakingTurns}
                    stageSize={stageSize}
                    actionButton={
                      p.role === "candidate" ? (
                        <button
                          type="button"
                          onClick={() => p.isCurrentSpeaker ? handleSpeakerChange(null) : handleSpeakerChange(p.rawMember || { candidate_id: p.userId, full_name: p.name, avatar_url: p.avatar })}
                          className={`btn ${p.isCurrentSpeaker ? "btn-outline" : "btn-primary"} btn-sm`}
                          style={{ padding: "3px 8px", fontSize: "10px", background: p.isCurrentSpeaker ? undefined : "var(--maroon)" }}
                        >
                          {p.isCurrentSpeaker ? "Revoke Floor" : "Give Floor →"}
                        </button>
                      ) : null
                    }
                  />
                );
              })}

              {!mainStageParticipants.length && (
                <div className="card" style={{ padding: "30px", textAlign: "center" }}>
                  <Users size={32} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
                  <h4>Waiting for participants to join</h4>
                  <p className="muted" style={{ fontSize: "12px" }}>Assigned candidates will appear here as they connect.</p>
                </div>
              )}
            </div>
          )}

          {/* 2. GOOGLE MEET HORIZONTAL PARTICIPANT STRIP (All 6, 8, 10, 15+ candidates) */}
          <GDParticipantStrip
            participants={allParticipants}
            activeSpeakerId={Object.keys(activeSpeakers).find(k => activeSpeakers[k])}
            pinnedUserId={pinnedUserId}
            onSelectParticipant={(uid) => togglePinParticipant(uid)}
            onTogglePin={(uid) => togglePinParticipant(uid)}
            mainStageUserIds={mainStageUserIds}
          />

          {/* 3. GOOGLE MEET FLOATING BOTTOM CONTROL BAR */}
          <div className="gd-meet-control-bar">
            {/* Left Info */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#FFFFFF" }}>
                {selectedDiscussion?.title || "Group Discussion"}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.7)" }}>
                · {allParticipants.length} people
              </span>
            </div>

            {/* Center Call Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Mic toggle */}
              <button
                type="button"
                onClick={toggleMic}
                className={`meet-ctrl-round-btn ${!mic ? "danger-off" : ""}`}
                title={mic ? "Turn off microphone" : "Turn on microphone"}
              >
                {mic ? <Mic size={18} /> : <MicOff size={18} />}
              </button>

              {/* Camera toggle */}
              <button
                type="button"
                onClick={toggleCamera}
                className={`meet-ctrl-round-btn ${!camera ? "danger-off" : ""}`}
                title={camera ? "Turn off camera" : "Turn on camera"}
              >
                {camera ? <Video size={18} /> : <VideoOff size={18} />}
              </button>

              {/* Screen Share toggle */}
              <button
                type="button"
                onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                className={`meet-ctrl-round-btn ${isSharingScreen ? "active-accent" : ""}`}
                title={isSharingScreen ? "Stop sharing screen" : "Share screen"}
              >
                <Monitor size={18} />
              </button>

              {/* Fullscreen / Screen Adjustment button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`meet-ctrl-pill-btn ${isFullscreen ? "active" : ""}`}
                title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
              </button>

              {/* End Discussion */}
              <button
                type="button"
                onClick={() => setShowEndModal(true)}
                className="meet-ctrl-leave-btn"
                title="End Group Discussion for everyone"
              >
                <StopCircle size={16} /> End GD
              </button>
            </div>

            {/* Right Drawer Toggles */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setActiveDrawer(prev => prev === "chat" ? null : "chat")}
                className={`meet-ctrl-pill-btn ${activeDrawer === "chat" ? "active" : ""}`}
                title="Toggle Room Chat"
              >
                <MessageCircle size={14} /> Chat
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer(prev => prev === "transcripts" ? null : "transcripts")}
                className={`meet-ctrl-pill-btn ${activeDrawer === "transcripts" ? "active" : ""}`}
                title="Toggle Live Transcripts"
              >
                <FileText size={14} /> Transcripts ({transcripts.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer(prev => prev === "analysis" ? null : "analysis")}
                className={`meet-ctrl-pill-btn ${activeDrawer === "analysis" ? "active" : ""}`}
                title="Toggle AI Analysis"
              >
                <Brain size={14} /> AI Analysis
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer(prev => prev === "participants" ? null : "participants")}
                className={`meet-ctrl-pill-btn ${activeDrawer === "participants" ? "active" : ""}`}
                title="Toggle Participant Roster"
              >
                <Users size={14} /> ({allParticipants.length})
              </button>
            </div>
          </div>
        </section>

        {/* Right Side: Collapsible Google Meet Drawer */}
        {activeDrawer && (
          <aside style={{ minWidth: 0 }}>
            
            {/* DRAWER: CHAT */}
            {activeDrawer === "chat" && (
              <section className="card" style={{ padding: "16px", borderRadius: "14px", height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <MessageCircle size={16} /> Room Chat
                  </h3>
                  <button className="icon-btn" onClick={() => setActiveDrawer(null)} style={{ width: "26px", height: "26px" }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ flex: 1, minHeight: "340px", maxHeight: "460px", overflowY: "auto", background: "#FAF6F3", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {!messages.length && (
                    <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "12px", margin: "auto 0" }}>
                      No messages yet. Send a broadcast note or message to the room.
                    </p>
                  )}
                  {messages.map(m => {
                    const isMine = m.sender_id === interviewerId;
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isMine ? "flex-end" : "flex-start",
                          maxWidth: "88%",
                          background: isMine ? "#F4E8E2" : "#fff",
                          border: `1px solid ${isMine ? "#E0CBC1" : "var(--line)"}`,
                          padding: "8px 12px",
                          borderRadius: "10px"
                        }}
                      >
                        <span style={{ fontSize: "10px", fontWeight: "800", color: "var(--maroon)", display: "block" }}>
                          {isMine ? "You (Moderator)" : m.sender_name || "Candidate"}
                        </span>
                        <p style={{ margin: "2px 0", fontSize: "12px", color: "var(--ink)", lineHeight: "1.4" }}>
                          {m.message}
                        </p>
                        <time style={{ fontSize: "8px", color: "var(--muted)", display: "block", textAlign: "right" }}>
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
                    placeholder="Type a message..."
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
            )}

            {/* DRAWER: LIVE TRANSCRIPTS */}
            {activeDrawer === "transcripts" && (
              <section className="card" style={{ padding: "16px", borderRadius: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <FileText size={16} /> Live Transcripts ({transcripts.length})
                  </h3>
                  <button className="icon-btn" onClick={() => setActiveDrawer(null)} style={{ width: "26px", height: "26px" }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ maxHeight: "440px", overflowY: "auto", background: "#FAF6F3", borderRadius: "8px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {!transcripts.length && (
                    <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "12px", margin: "auto 0", padding: "30px 10px" }}>
                      No speech transcripts captured yet. When candidates speak, speech-to-text appears here in real time.
                    </p>
                  )}
                  {transcripts.map((t, idx) => (
                    <div key={idx} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "8px", padding: "8px 12px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <b style={{ fontSize: "11px", color: "var(--maroon)" }}>{t.speakerName || t.speaker_name || "Candidate"}</b>
                        <span style={{ fontSize: "9px", color: "var(--muted)" }}>
                          {t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : ""}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--ink)", lineHeight: "1.4" }}>
                        "{t.text || t.transcript}"
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* DRAWER: AI GD ANALYSIS */}
            {activeDrawer === "analysis" && (
              <section className="card" style={{ padding: "16px", borderRadius: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Brain size={16} color="var(--maroon)" /> AI GD Evaluation
                  </h3>
                  <button className="icon-btn" onClick={() => setActiveDrawer(null)} style={{ width: "26px", height: "26px" }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <button
                    className="btn btn-primary btn-full"
                    onClick={runAIEvaluation}
                    disabled={analyzing}
                    style={{ background: "var(--maroon)" }}
                  >
                    {analyzing ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                    {analyzing ? "Evaluating Transcripts..." : "Run AI Multi-Candidate Analysis"}
                  </button>
                </div>

                {aiAnalysis && (
                  <div style={{ maxHeight: "420px", overflowY: "auto", display: "grid", gap: "10px" }}>
                    <div style={{ background: "#FAF5F2", padding: "10px", borderRadius: "8px", border: "1px solid var(--line)" }}>
                      <span style={{ fontSize: "10px", fontWeight: "800", color: "var(--maroon)" }}>OVERALL SUMMARY</span>
                      <p style={{ margin: "3px 0 0", fontSize: "11px", lineHeight: "1.4" }}>{aiAnalysis.overall_summary}</p>
                    </div>

                    {Object.values(aiAnalysis.evaluations || {}).map(evalData => (
                      <div key={evalData.candidate_id} style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "8px", padding: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <b style={{ fontSize: "12px" }}>{evalData.candidate_name}</b>
                          <Badge tone={evalData.recommendation === "strong_hire" || evalData.recommendation === "hire" ? "success" : "warning"}>
                            Score: {evalData.overall_score}/100
                          </Badge>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "10px", marginBottom: "6px" }}>
                          <div>Communication: <b>{evalData.communication_score}%</b></div>
                          <div>Leadership: <b>{evalData.leadership_score}%</b></div>
                          <div>Teamwork: <b>{evalData.teamwork_score}%</b></div>
                          <div>Relevance: <b>{evalData.relevance_score}%</b></div>
                          <div>Critical Thinking: <b>{evalData.critical_thinking_score}%</b></div>
                          <div>Confidence: <b>{evalData.confidence_score}%</b></div>
                        </div>

                        <p style={{ margin: "2px 0", fontSize: "11px", color: "var(--ink)", fontStyle: "italic" }}>
                          "{evalData.feedback}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* DRAWER: PARTICIPANT ROSTER */}
            {activeDrawer === "participants" && (
              <section className="card" style={{ padding: "16px", borderRadius: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Users size={16} /> All Participants ({allParticipants.length})
                  </h3>
                  <button className="icon-btn" onClick={() => setActiveDrawer(null)} style={{ width: "26px", height: "26px" }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <input
                    value={participantSearch}
                    onChange={e => setParticipantSearch(e.target.value)}
                    placeholder="Search participants..."
                    style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--line)", fontSize: "12px", background: "#FAF5F2" }}
                  />
                </div>

                <div style={{ maxHeight: "420px", overflowY: "auto", display: "grid", gap: "6px" }}>
                  {allParticipants
                    .filter(p => p.name.toLowerCase().includes(participantSearch.toLowerCase()))
                    .map((p) => {
                      const isPinned = pinnedUserId === p.userId;
                      return (
                        <div
                          key={p.userId}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            background: isPinned ? "#F4E8E2" : "#FAF5F2",
                            border: isPinned ? "1.5px solid var(--maroon)" : "1px solid var(--line)"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden" }}>
                              <img src={p.avatar} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                            <div>
                              <b style={{ fontSize: "12px", display: "block" }}>{p.name} {p.isLocal ? "(You)" : ""}</b>
                              <small style={{ fontSize: "9px", color: "var(--muted)" }}>{p.role.toUpperCase()}</small>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {p.isMicOn ? <Mic size={13} color="#16a34a" /> : <MicOff size={13} color="#ef4444" />}
                            {p.isCameraOn ? <Video size={13} color="#16a34a" /> : <VideoOff size={13} color="#ef4444" />}
                            <button
                              onClick={() => togglePinParticipant(p.userId)}
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: isPinned ? "var(--maroon)" : "var(--muted)" }}
                              title={isPinned ? "Unpin participant" : "Pin participant"}
                            >
                              {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>

      {/* ── CREATE GD MODAL ─────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            style={{
              maxWidth: "540px",
              background: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid rgba(0, 83, 122, 0.18)",
              boxShadow: "0 24px 60px rgba(1, 60, 88, 0.18)",
              borderRadius: "22px",
              color: "#013C58",
              padding: "24px"
            }}
          >
            <div className="modal-head" style={{ borderBottom: "1px solid rgba(0, 83, 122, 0.12)", paddingBottom: "12px", marginBottom: "16px" }}>
              <h3 style={{ color: "#013C58", fontWeight: 800, fontSize: "18px", margin: 0 }}>Schedule Group Discussion</h3>
              <button className="icon-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateGD} style={{ display: "grid", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#013C58", display: "block", marginBottom: "5px" }}>
                  Session Title
                </label>
                <input
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Fullstack Engineering GD Round"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(0, 83, 122, 0.2)",
                    background: "#FFFFFF",
                    color: "#013C58",
                    fontSize: "13px"
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#013C58", display: "block", marginBottom: "5px" }}>
                  Discussion Topic
                </label>
                <select
                  value={formTopic}
                  onChange={e => setFormTopic(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "10px",
                    border: "1px solid rgba(0, 83, 122, 0.2)",
                    background: "#FFFFFF",
                    color: "#013C58",
                    fontSize: "13px",
                    marginBottom: formTopic === "custom" ? "8px" : "0"
                  }}
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
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(0, 83, 122, 0.2)",
                      background: "#FFFFFF",
                      color: "#013C58",
                      fontSize: "13px"
                    }}
                  />
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#013C58", display: "block", marginBottom: "5px" }}>
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(0, 83, 122, 0.2)",
                      background: "#FFFFFF",
                      color: "#013C58",
                      fontSize: "13px"
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#013C58", display: "block", marginBottom: "5px" }}>
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(0, 83, 122, 0.2)",
                      background: "#FFFFFF",
                      color: "#013C58",
                      fontSize: "13px"
                    }}
                  />
                </div>
              </div>

              {/* Quick Time Slots */}
              <div>
                <span style={{ fontSize: "11px", color: "#416477", fontWeight: "700", display: "block", marginBottom: "6px" }}>
                  Quick Time Slots:
                </span>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[
                    { label: "09:00 AM", value: "09:00" },
                    { label: "10:00 AM", value: "10:00" },
                    { label: "11:30 AM", value: "11:30" },
                    { label: "02:00 PM", value: "14:00" },
                    { label: "03:30 PM", value: "15:30" },
                    { label: "05:00 PM", value: "17:00" }
                  ].map(slot => (
                    <button
                      key={slot.value}
                      type="button"
                      onClick={() => setFormTime(slot.value)}
                      className={`btn btn-sm ${formTime === slot.value ? "btn-primary" : "btn-outline"}`}
                      style={{ padding: "4px 10px", fontSize: "11px", borderRadius: "8px" }}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#013C58", display: "block", marginBottom: "5px" }}>
                    Associated Job
                  </label>
                  <select
                    value={formJobId}
                    onChange={e => setFormJobId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(0, 83, 122, 0.2)",
                      background: "#FFFFFF",
                      color: "#013C58",
                      fontSize: "13px"
                    }}
                  >
                    <option value="">General Assessment</option>
                    {jobsList.map(j => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#013C58", display: "block", marginBottom: "5px" }}>
                    Duration (Minutes)
                  </label>
                  <select
                    value={formDuration}
                    onChange={e => setFormDuration(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      border: "1px solid rgba(0, 83, 122, 0.2)",
                      background: "#FFFFFF",
                      color: "#013C58",
                      fontSize: "13px"
                    }}
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                  </select>
                </div>
              </div>

              {/* INVITE CANDIDATES LIST */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: "700", color: "#013C58", display: "block", marginBottom: "6px" }}>
                  Invite Candidates ({formSelectedCandidates.length} Selected)
                </label>
                <div className="candidate-invite-list">
                  {candidatesList.map(c => {
                    const isChecked = formSelectedCandidates.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`candidate-invite-row ${isChecked ? "is-selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="candidate-invite-checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setFormSelectedCandidates(prev => [...prev, c.id]);
                            } else {
                              setFormSelectedCandidates(prev => prev.filter(id => id !== c.id));
                            }
                          }}
                        />
                        <div className="candidate-invite-info">
                          <span className="candidate-invite-name">
                            {c.full_name || "Candidate"}
                          </span>
                          <span className="candidate-invite-email">
                            {c.email || "No email provided"}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                  {!candidatesList.length && (
                    <p style={{ textAlign: "center", color: "#416477", fontSize: "12px", margin: "16px 0" }}>
                      No candidate profiles found.
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px", borderTop: "1px solid rgba(0, 83, 122, 0.1)", paddingTop: "12px" }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating} style={{ padding: "9px 20px" }}>
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
          <div className="modal-card" style={{ maxWidth: "440px", textAlign: "center", padding: "28px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(217, 56, 30, 0.12)",
                color: "#D9381E",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 14px"
              }}
            >
              <StopCircle size={32} />
            </div>
            <h3 style={{ fontSize: "18px", color: "var(--navy)", fontWeight: 800, margin: "0 0 8px" }}>
              End Group Discussion?
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "13px", lineHeight: 1.5, margin: "0 0 22px" }}>
              Ending the Group Discussion will disconnect all candidates and close the session for everyone.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowEndModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ background: "#D9381E", borderColor: "#D9381E", padding: "8px 20px" }}
                onClick={() => {
                  setShowEndModal(false);
                  handleStatusChange("completed");
                }}
              >
                End Group Discussion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}