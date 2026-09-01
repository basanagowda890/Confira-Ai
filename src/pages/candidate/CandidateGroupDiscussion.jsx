import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
  ArrowRight,
  Monitor,
  StopCircle,
  FileText,
  Pin,
  PinOff,
  Maximize2,
  Minimize2,
  Briefcase,
  UserCheck,
  Info,
  Calendar,
  X
} from "lucide-react";
import Badge from "../../components/Badge";
import Toast from "../../components/Toast";
import SectionTitle from "../../components/SectionTitle";
import GDVideoTile from "../../components/GDVideoTile";
import GDScreenViewer from "../../components/GDScreenViewer";
import GDParticipantStrip from "../../components/GDParticipantStrip";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";
import { useGDWebRTC } from "../../lib/useGDWebRTC";

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
  const [toast, setToast] = useState("");
  const [handRaised, setHandRaised] = useState(false);

  // Joining & Lifecycle States
  const [hasEnteredGD, setHasEnteredGD] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [endedReason, setEndedReason] = useState("");

  // Fullscreen State & Ref
  const meetingContainerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Google Meet UI State
  const [pinnedUserId, setPinnedUserId] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState("chat"); // "chat" | "participants" | null

  // Real-time State
  const [currentSpeaker, setCurrentSpeaker] = useState(null);
  const [messages, setMessages] = useState([]);
  const [transcripts, setTranscripts] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [remainingTime, setRemainingTime] = useState("");
  const [activityEvents, setActivityEvents] = useState([]);

  const candidateName = profile?.full_name || "Candidate";
  const candidateId = user?.id;

  const addActivity = useCallback((text) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setActivityEvents(prev => [{ time, text }, ...prev.slice(0, 20)]);
  }, []);

  const handleNewTranscript = useCallback((payload) => {
    setTranscripts(prev => [...prev, payload]);
  }, []);

  // Is this discussion ended in data or state?
  const isDiscEnded = Boolean(
    isEnded ||
    discussion?.status === "completed" ||
    discussion?.status === "cancelled" ||
    discussion?.ended_at
  );

  const isCancelled = Boolean(discussion?.status === "cancelled");

  // WebRTC Mesh Hook (active ONLY when candidate confirmed entry and session is not ended)
  const isWebRTCActive = Boolean(hasEnteredGD && !isDiscEnded && discussion?.id);

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
    discussionId: isWebRTCActive ? discussion?.id : null,
    meetingRoomId: isWebRTCActive ? (discussion?.meeting_room_id || discussion?.id) : null,
    userId: candidateId,
    userName: candidateName,
    userAvatar: profile?.avatar_url,
    userRole: "candidate",
    enabled: isWebRTCActive,
    onToast: setToast,
    onActivity: addActivity,
    onTranscript: handleNewTranscript,
  });

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
        targetDisc = list.find(d => d.status === "live") || list[0];
      }

      if (targetDisc) {
        const detRes = await api.get(`/group-discussions/${targetDisc.id}`);
        const det = detRes?.data || detRes || targetDisc;
        setDiscussion(det);
        setCurrentSpeaker(det.current_speaker || null);

        // Check if already ended or cancelled
        if (det.status === "completed" || det.ended_at) {
          setIsEnded(true);
          setEndedReason("This Group Discussion has already ended.");
        } else if (det.status === "cancelled") {
          setIsEnded(true);
          setEndedReason("This Group Discussion has been cancelled.");
        }

        // Load messages & transcripts
        try {
          const [msgRes, transRes] = await Promise.allSettled([
            api.get(`/group-discussions/${targetDisc.id}/messages`),
            api.get(`/group-discussions/${targetDisc.id}/transcripts`),
          ]);
          if (msgRes.status === "fulfilled") {
            setMessages(Array.isArray(msgRes.value) ? msgRes.value : (msgRes.value?.data || []));
          }
          if (transRes.status === "fulfilled") {
            setTranscripts(Array.isArray(transRes.value) ? transRes.value : (transRes.value?.data || []));
          }
        } catch {}
      }
    } catch {
      setToast("Failed to load group discussion details.");
    } finally {
      setLoading(false);
    }
  }, [discussionIdParam]);

  useEffect(() => {
    loadDiscussions();
  }, [loadDiscussions]);

  // Handle Moderator Ending GD for Everyone
  const triggerGDEnded = useCallback((reasonText = "The interviewer has ended this Group Discussion.") => {
    cleanupMediaAndConnections();
    setIsEnded(true);
    setHasEnteredGD(false);
    setEndedReason(reasonText);
    setToast(reasonText);
  }, [cleanupMediaAndConnections]);

  // 2. Real-time Channel Extra Event Handlers
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;

    channel
      ?.on("broadcast", { event: "gd_status_changed" }, ({ payload }) => {
        if (payload?.status) {
          setDiscussion(prev => prev ? { ...prev, ...payload } : prev);
          if (payload.status === "live") {
            setToast("🟢 Discussion is now LIVE!");
          } else if (payload.status === "paused") {
            setToast("Discussion is PAUSED by moderator.");
          } else if (payload.status === "completed" || payload.status === "cancelled") {
            triggerGDEnded(payload.status === "cancelled" ? "This Group Discussion was cancelled." : "The interviewer has ended this Group Discussion.");
          }
        }
      })
      ?.on("broadcast", { event: "gd_ended" }, () => {
        triggerGDEnded("The interviewer has ended this Group Discussion.");
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
      ?.on("broadcast", { event: "chat_message" }, ({ payload }) => {
        if (payload?.id) {
          setMessages(prev => prev.some(m => m.id === payload.id) ? prev : [...prev, payload]);
        }
      });
  }, [channelRef, candidateId, triggerGDEnded]);

  // 3. Supabase Realtime Database Listener on group_discussions table
  useEffect(() => {
    if (!discussion?.id) return;
    const unsub = subscribeToTable("group_discussions", (payload) => {
      if (payload?.new && payload.new.id === discussion.id) {
        const newRecord = payload.new;
        setDiscussion(prev => prev ? { ...prev, ...newRecord } : newRecord);
        if (newRecord.status === "completed" || newRecord.status === "cancelled" || newRecord.ended_at) {
          triggerGDEnded(newRecord.status === "cancelled" ? "This Group Discussion was cancelled." : "The interviewer has ended this Group Discussion.");
        }
      }
    });

    return () => {
      unsub?.();
    };
  }, [discussion?.id, triggerGDEnded]);

  // 4. Synchronized Server Countdown Timer
  useEffect(() => {
    if (!discussion || discussion.status !== "live" || !discussion.started_at || isDiscEnded) {
      setRemainingTime(isDiscEnded ? "00:00" : `${discussion?.duration_minutes || 45}:00`);
      return;
    }

    const durationSec = (discussion.duration_minutes || 45) * 60;
    const startMs = new Date(discussion.started_at).getTime();

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
      const leftSec = Math.max(0, durationSec - elapsedSec);

      const m = Math.floor(leftSec / 60);
      const s = leftSec % 60;
      setRemainingTime(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);

      if (leftSec <= 0) {
        triggerGDEnded("Group Discussion duration has concluded.");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [discussion, isDiscEnded, triggerGDEnded]);

  // 5. Fullscreen Handler
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

  // 6. Raise Hand Toggle
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
    setToast(next ? "✋ Hand raised. The moderator has been notified." : "Hand lowered.");
  }

  // 7. Send Chat Message
  async function sendMessage(e) {
    e?.preventDefault();
    const text = msgText.trim();
    if (!text || !discussion) return;

    const newMsg = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      discussion_id: discussion.id,
      sender_id: candidateId,
      sender_name: candidateName,
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
      await api.post(`/group-discussions/${discussion.id}/messages`, { message: text });
    } catch {}
  }

  // 8. Leave Discussion (Only this candidate leaves)
  async function handleLeave() {
    cleanupMediaAndConnections();
    if (discussion) {
      try {
        await api.post(`/group-discussions/${discussion.id}/leave`);
      } catch {}
    }
    navigate("/candidate/interviews");
  }

  // 9. Enter / Join Discussion Action
  async function handleConfirmEntry() {
    if (isDiscEnded) {
      setToast("This Group Discussion has already ended.");
      return;
    }
    setHasEnteredGD(true);
    if (discussion?.id) {
      try {
        await api.post(`/group-discussions/${discussion.id}/join`);
      } catch {}
    }
    setToast(discussion?.status === "live" ? "Joined live Group Discussion room!" : "Entered Group Discussion room!");
  }

  // 10. Unified Participant List
  const members = discussion?.members || [];
  const moderatorId = discussion?.created_by;
  const moderatorProfile = discussion?.profiles || {};

  const allParticipants = useMemo(() => {
    const list = [];

    // Self (Candidate)
    list.push({
      userId: candidateId,
      name: candidateName,
      role: "candidate",
      avatar: profile?.avatar_url,
      stream: localStream,
      isLocal: true,
      isCameraOn: camera,
      isMicOn: mic,
      isSpeaking: Boolean(activeSpeakers[candidateId]),
      isScreenSharing: isSharingScreen,
      speakingTurns: speakingMetrics[candidateId]?.turns || 0,
      isCurrentSpeaker: currentSpeaker?.id === candidateId
    });

    // Moderator
    if (moderatorId && moderatorId !== candidateId) {
      const pres = presenceMap[moderatorId];
      list.push({
        userId: moderatorId,
        name: moderatorProfile.full_name || "Interviewer (Moderator)",
        role: "interviewer",
        avatar: moderatorProfile.avatar_url,
        stream: remoteStreams[moderatorId] || null,
        isLocal: false,
        isCameraOn: pres ? pres.camera : true,
        isMicOn: pres ? pres.mic : true,
        isSpeaking: Boolean(activeSpeakers[moderatorId]),
        isScreenSharing: Boolean(pres?.is_screen_sharing),
        speakingTurns: speakingMetrics[moderatorId]?.turns || 0,
        isCurrentSpeaker: currentSpeaker?.id === moderatorId
      });
    }

    // Other Candidates
    members.forEach((m, idx) => {
      const cid = m.candidate_id;
      if (cid === candidateId || cid === moderatorId) return;

      const pres = presenceMap[cid];
      const stream = remoteStreams[cid];
      const photo = m.avatar_url || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length];

      list.push({
        userId: cid,
        name: m.full_name || "Candidate",
        role: "candidate",
        avatar: photo,
        stream: stream || null,
        isLocal: false,
        isCameraOn: pres ? pres.camera : true,
        isMicOn: pres ? pres.mic : true,
        isSpeaking: Boolean(activeSpeakers[cid] || pres?.isSpeaking),
        isScreenSharing: Boolean(pres?.is_screen_sharing),
        speakingTurns: speakingMetrics[cid]?.turns || 0,
        isCurrentSpeaker: currentSpeaker?.id === cid,
      });
    });

    // Any other peer in presence
    Object.keys(presenceMap).forEach(pid => {
      if (pid !== candidateId && pid !== moderatorId && !members.some(m => m.candidate_id === pid)) {
        const pres = presenceMap[pid];
        list.push({
          userId: pid,
          name: pres?.name || "Participant",
          role: pres?.role || "candidate",
          avatar: pres?.avatar_url || DEFAULT_AVATARS[0],
          stream: remoteStreams[pid] || null,
          isLocal: false,
          isCameraOn: pres ? pres.camera : true,
          isMicOn: pres ? pres.mic : true,
          isSpeaking: Boolean(activeSpeakers[pid]),
          isScreenSharing: Boolean(pres?.is_screen_sharing),
          speakingTurns: speakingMetrics[pid]?.turns || 0,
          isCurrentSpeaker: currentSpeaker?.id === pid,
        });
      }
    });

    return list;
  }, [
    candidateId,
    candidateName,
    profile?.avatar_url,
    localStream,
    camera,
    mic,
    activeSpeakers,
    isSharingScreen,
    speakingMetrics,
    currentSpeaker,
    moderatorId,
    moderatorProfile,
    presenceMap,
    remoteStreams,
    members
  ]);

  // Google Meet Stage Calculation
  const mainStageParticipants = useMemo(() => {
    if (pinnedUserId) {
      const pinned = allParticipants.find(p => p.userId === pinnedUserId);
      if (pinned) return [pinned];
    }
    return allParticipants.slice(0, 4);
  }, [allParticipants, pinnedUserId]);

  const mainStageUserIds = useMemo(() => {
    return mainStageParticipants.map(p => p.userId);
  }, [mainStageParticipants]);

  function togglePinParticipant(uid) {
    setPinnedUserId(prev => (prev === uid ? null : uid));
  }

  const isUserSpeaking = currentSpeaker?.id === candidateId;
  const hasActiveScreenShare = Boolean(remoteScreen?.stream || screenStream);

  // Format Scheduled Date & Time strictly from database timestamp
  const scheduledDateStr = useMemo(() => {
    if (!discussion?.scheduled_at) return "15 September 2026";
    try {
      const d = new Date(discussion.scheduled_at);
      if (isNaN(d.getTime())) return "15 September 2026";
      return d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return "15 September 2026";
    }
  }, [discussion?.scheduled_at]);

  const scheduledTimeStr = useMemo(() => {
    if (!discussion?.scheduled_at) return "10:30 AM";
    try {
      const d = new Date(discussion.scheduled_at);
      if (isNaN(d.getTime())) return "10:30 AM";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "10:30 AM";
    }
  }, [discussion?.scheduled_at]);

  const statusLabel = useMemo(() => {
    if (isCancelled) return "Cancelled";
    if (isDiscEnded) return "Ended";
    if (discussion?.status === "live") return "Live Now";
    return "Scheduled";
  }, [isCancelled, isDiscEnded, discussion?.status]);

  // ============================================================
  // RENDER: Loading State
  // ============================================================
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <Loader2 className="spinner" size={40} style={{ color: "var(--deep-blue)", margin: "0 auto 16px" }} />
        <h3 style={{ color: "var(--navy)" }}>Loading Group Discussion Details...</h3>
        <p className="muted">Fetching scheduled session data from server...</p>
      </div>
    );
  }

  // ============================================================
  // RENDER: No Discussion Found
  // ============================================================
  if (!discussion) {
    return (
      <div>
        <SectionTitle
          eyebrow="GROUP DISCUSSION"
          title="Group Discussions"
          description="Join collaborative evaluation sessions with fellow candidates and moderators."
        />
        <div className="card" style={{ textAlign: "center", padding: "60px 20px", maxWidth: "600px", margin: "40px auto" }}>
          <Users size={48} style={{ color: "var(--muted)", margin: "0 auto 16px" }} />
          <h3>No Group Discussion Scheduled</h3>
          <p className="muted" style={{ margin: "10px 0 20px" }}>
            You do not currently have any active or upcoming group discussion sessions.
          </p>
          <Link to="/candidate/interviews" className="btn btn-primary" style={{ display: "inline-flex", margin: "0 auto" }}>
            View My Interviews
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Discussion Ended / Cancelled View (when in ended state)
  // ============================================================
  if (isDiscEnded && !hasEnteredGD) {
    return (
      <div className="gd-details-screen-bg">
        {/* Subtle decorative mesh and floating light gradient orbs */}
        <div className="gd-details-mesh-grid" />
        <div className="gd-details-orb gd-details-orb-1" />
        <div className="gd-details-orb gd-details-orb-2" />
        <div className="gd-details-orb gd-details-orb-3" />

        <Toast message={toast} onClose={() => setToast("")} />

        <div className="gd-details-wrapper">
          <div className="gd-details-card">
            <div className="gd-details-header">
              <div>
                <span
                  className="badge"
                  style={{
                    marginBottom: "8px",
                    display: "inline-block",
                    background: isCancelled ? "rgba(107, 114, 128, 0.15)" : "rgba(217, 56, 30, 0.15)",
                    color: isCancelled ? "#4B5563" : "#D9381E",
                    fontWeight: 800
                  }}
                >
                  {isCancelled ? "⚪ Cancelled" : "🔴 Ended"}
                </span>
                <h2>Group Discussion Details</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                  {endedReason || (isCancelled ? "This Group Discussion was cancelled by the recruiter." : "This Group Discussion has already ended.")}
                </p>
              </div>
            </div>

            {/* Topic Box */}
            <div className="gd-details-topic-box">
              <small>Topic</small>
              <h3>"{discussion.topic || discussion.title}"</h3>
            </div>

            {/* Key Information Grid */}
            <div className="gd-details-grid">
              <div className="gd-details-item">
                <small><Briefcase size={12} /> Position</small>
                <span>{discussion.jobs?.title || "Software Developer"}</span>
              </div>

              <div className="gd-details-item">
                <small><UserCheck size={12} /> Interviewer</small>
                <span>{discussion.profiles?.full_name || "John Smith"}</span>
              </div>

              <div className="gd-details-item">
                <small><Calendar size={12} /> Scheduled Date</small>
                <span>{scheduledDateStr}</span>
              </div>

              <div className="gd-details-item">
                <small><Clock3 size={12} /> Scheduled Time</small>
                <span>{scheduledTimeStr}</span>
              </div>

              <div className="gd-details-item">
                <small><Clock3 size={12} /> Duration</small>
                <span>{discussion.duration_minutes || 45} minutes</span>
              </div>

              <div className="gd-details-item">
                <small><Users size={12} /> Participants</small>
                <span>{members.length > 0 ? `${members.length} candidates` : "Group Discussion"}</span>
              </div>
            </div>

            <div className="gd-details-actions">
              <Link to="/candidate/interviews" className="btn btn-primary" style={{ padding: "9px 22px" }}>
                Back to Interviews
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Professional "GROUP DISCUSSION DETAILS" View (Before Joining)
  // ============================================================
  if (!hasEnteredGD) {
    const isLive = discussion.status === "live";

    return (
      <div className="gd-details-screen-bg">
        {/* Subtle decorative mesh and floating light gradient orbs */}
        <div className="gd-details-mesh-grid" />
        <div className="gd-details-orb gd-details-orb-1" />
        <div className="gd-details-orb gd-details-orb-2" />
        <div className="gd-details-orb gd-details-orb-3" />

        <Toast message={toast} onClose={() => setToast("")} />

        <div className="gd-details-wrapper">
          <div className="gd-details-card">
            <div className="gd-details-header">
              <div>
                <span
                  className="badge"
                  style={{
                    marginBottom: "8px",
                    display: "inline-block",
                    background: isLive ? "rgba(217, 56, 30, 0.15)" : "rgba(245, 162, 1, 0.18)",
                    color: isLive ? "#D9381E" : "#00537A",
                    fontWeight: 800
                  }}
                >
                  {isLive ? "🟢 Live Now" : "🟡 Scheduled"}
                </span>
                <h2>GROUP DISCUSSION DETAILS</h2>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>
                  Please review the session outline and meeting guidelines below.
                </p>
              </div>
            </div>

            {/* Topic Box */}
            <div className="gd-details-topic-box">
              <small>Topic</small>
              <h3>"{discussion.topic || discussion.title}"</h3>
            </div>

            {/* Information Grid */}
            <div className="gd-details-grid">
              <div className="gd-details-item">
                <small><Briefcase size={12} /> Position</small>
                <span>{discussion.jobs?.title || "Software Developer"}</span>
              </div>

              <div className="gd-details-item">
                <small><UserCheck size={12} /> Interviewer</small>
                <span>{discussion.profiles?.full_name || "John Smith"}</span>
              </div>

              <div className="gd-details-item">
                <small><Calendar size={12} /> Date</small>
                <span>{scheduledDateStr}</span>
              </div>

              <div className="gd-details-item">
                <small><Clock3 size={12} /> Time</small>
                <span>{scheduledTimeStr}</span>
              </div>

              <div className="gd-details-item">
                <small><Clock3 size={12} /> Duration</small>
                <span>{discussion.duration_minutes || 45} minutes</span>
              </div>

              <div className="gd-details-item">
                <small><Users size={12} /> Participants</small>
                <span>{members.length > 0 ? `${members.length} candidates` : "Group Discussion Roster"}</span>
              </div>

              <div className="gd-details-item">
                <small><Info size={12} /> Status</small>
                <span style={{ textTransform: "capitalize", color: isLive ? "#D9381E" : "var(--deep-blue)" }}>
                  {statusLabel}
                </span>
              </div>

              <div className="gd-details-item">
                <small><Radio size={12} /> Meeting Availability</small>
                <span>{isLive ? "Room is Open & Active" : "Waiting for Moderator"}</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="gd-details-instructions">
              <Info size={18} color="var(--deep-blue)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <b style={{ color: "var(--deep-blue)", display: "block", marginBottom: "2px" }}>Instructions</b>
                <span>
                  {discussion.instructions || "Please join 5 minutes before the session, ensure a stable internet connection, and keep your camera and microphone ready."}
                </span>
              </div>
            </div>

            {/* Security / Media Permission notice */}
            <div style={{ background: "rgba(168, 232, 249, 0.25)", border: "1px solid rgba(0, 83, 122, 0.15)", borderRadius: "12px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px", color: "var(--navy)" }}>
              <Sparkles size={16} color="var(--deep-blue)" style={{ flexShrink: 0 }} />
              <span>Camera and microphone permissions will be initialized only after clicking the button below.</span>
            </div>

            {/* Action Buttons */}
            <div className="gd-details-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate("/candidate/interviews")}
                style={{ padding: "9px 20px" }}
              >
                Back
              </button>

              {isLive ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmEntry}
                  style={{
                    padding: "10px 24px",
                    fontSize: "14px",
                    fontWeight: 800,
                    background: "linear-gradient(135deg, #00537A, #013C58)",
                    boxShadow: "0 4px 14px rgba(0, 83, 122, 0.3)"
                  }}
                >
                  <Radio size={15} className="live-dot" /> Join Group Discussion
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmEntry}
                  style={{
                    padding: "10px 24px",
                    fontSize: "14px",
                    fontWeight: 800,
                    background: "linear-gradient(135deg, #00537A, #013C58)"
                  }}
                >
                  <ArrowRight size={15} /> Enter Group Discussion
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Active Live Group Discussion (Google Meet Layout)
  // ============================================================
  return (
    <div
      ref={meetingContainerRef}
      className={`gd-meeting-container ${isFullscreen ? "is-fullscreen" : ""}`}
    >
      <Toast message={toast} onClose={() => setToast("")} />

      {/* Top Header Card */}
      <div className="card" style={{ padding: "14px 20px", marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
              <span className="badge badge-danger" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Radio size={12} className="live-dot" /> LIVE GD
              </span>
              <span style={{ fontSize: "12px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <Clock3 size={13} /> Time Remaining: <b>{remainingTime}</b>
              </span>
            </div>
            <h2 style={{ margin: 0, fontSize: "17px", color: "var(--navy)", fontWeight: 800 }}>
              {discussion?.topic || discussion?.title}
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Badge tone="info">
              {allParticipants.length} Connected
            </Badge>
          </div>
        </div>
      </div>

      {/* Floor / Current Speaker Alert Banner */}
      <div
        style={{
          padding: "10px 16px",
          borderRadius: "12px",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: isUserSpeaking ? "rgba(34, 197, 94, 0.15)" : currentSpeaker ? "rgba(245, 162, 1, 0.15)" : "rgba(0, 83, 122, 0.06)",
          border: isUserSpeaking ? "1.5px solid #22c55e" : currentSpeaker ? "1.5px solid #f59e0b" : "1px solid rgba(0, 83, 122, 0.15)"
        }}
      >
        <Volume2 size={18} color={isUserSpeaking ? "#16a34a" : currentSpeaker ? "#d97706" : "var(--deep-blue)"} />
        <div>
          {isUserSpeaking ? (
            <div>
              <b style={{ color: "#15803d", fontSize: "13px" }}>🎤 YOU HAVE THE FLOOR TO SPEAK</b>
              <span style={{ margin: "0 0 0 8px", color: "#166534", fontSize: "11px" }}>
                The moderator granted you the speaking floor. Present your thoughts clearly.
              </span>
            </div>
          ) : currentSpeaker ? (
            <div>
              <b style={{ color: "#b45309", fontSize: "13px" }}>
                CURRENT SPEAKER: {currentSpeaker.full_name || "Participant"}
              </b>
              <span style={{ margin: "0 0 0 8px", color: "#92400e", fontSize: "11px" }}>
                Please listen actively. Click 'Raise Hand' below to request the next speaking turn.
              </span>
            </div>
          ) : (
            <div>
              <b style={{ color: "var(--navy)", fontSize: "13px" }}>Floor is Open for Discussion</b>
              <span style={{ margin: "0 0 0 8px", color: "var(--muted)", fontSize: "11px" }}>
                Click 'Raise Hand' or unmute your mic to contribute to the discussion.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Google Meet Grid + Slide-Out Drawer */}
      <div style={{ display: "grid", gridTemplateColumns: activeDrawer ? "minmax(0, 1fr) 350px" : "1fr", gap: "16px", transition: "all 0.3s ease" }}>
        
        {/* Left / Center: Google Meet Stage & Participant Strip */}
        <section style={{ minWidth: 0 }}>
          
          {/* 1. PRIMARY STAGE: Screen Share (if active) OR Google Meet Video Grid (1-4 participants) */}
          {hasActiveScreenShare ? (
            <GDScreenViewer
              screenStream={remoteScreen?.stream || screenStream}
              sharerName={remoteScreen?.sharerName || (isSharingScreen ? "You" : "Participant")}
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
                  />
                );
              })}

              {!mainStageParticipants.length && (
                <div className="card" style={{ padding: "30px", textAlign: "center" }}>
                  <Users size={32} style={{ color: "var(--muted)", margin: "0 auto 8px" }} />
                  <h4>Waiting for participants to connect</h4>
                  <p className="muted" style={{ fontSize: "12px" }}>Other participants will appear as they join.</p>
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
                {discussion?.title || "Group Discussion"}
              </span>
              <span style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.7)" }}>
                · {allParticipants.length} participants
              </span>
            </div>

            {/* Center Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              {/* Mic toggle */}
              <button
                type="button"
                onClick={toggleMic}
                className={`meet-ctrl-round-btn ${!mic ? "danger-off" : ""}`}
                title={mic ? "Mute Microphone" : "Unmute Microphone"}
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
                {camera ? <Camera size={18} /> : <CameraOff size={18} />}
              </button>

              {/* Screen Share toggle */}
              <button
                type="button"
                onClick={isSharingScreen ? stopScreenShare : startScreenShare}
                className={`meet-ctrl-round-btn ${isSharingScreen ? "active-accent" : ""}`}
                title={isSharingScreen ? "Stop sharing screen" : "Share your screen"}
              >
                <Monitor size={18} />
              </button>

              {/* Raise Hand toggle */}
              <button
                type="button"
                onClick={toggleRaiseHand}
                className={`meet-ctrl-round-btn ${handRaised ? "active-accent" : ""}`}
                title={handRaised ? "Lower hand" : "Raise hand to speak"}
              >
                <Hand size={18} />
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

              {/* Leave Room Button */}
              <button
                type="button"
                onClick={handleLeave}
                className="meet-ctrl-leave-btn"
                title="Leave Group Discussion"
              >
                <PhoneOff size={16} /> Leave
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
                <MessageSquare size={14} /> Chat
              </button>

              <button
                type="button"
                onClick={() => setActiveDrawer(prev => prev === "participants" ? null : "participants")}
                className={`meet-ctrl-pill-btn ${activeDrawer === "participants" ? "active" : ""}`}
                title="Toggle People List"
              >
                <Users size={14} /> ({allParticipants.length})
              </button>
            </div>
          </div>
        </section>

        {/* Right Side: Collapsible Drawer */}
        {activeDrawer && (
          <aside style={{ minWidth: 0 }}>
            {activeDrawer === "chat" && (
              <section className="chat-box" style={{ background: "rgba(255, 255, 255, 0.9)", border: "1px solid rgba(0, 83, 122, 0.15)", borderRadius: "18px", padding: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", color: "var(--navy)" }}>
                    <MessageSquare size={16} /> GD Room Chat
                  </h3>
                  <button type="button" className="icon-btn" onClick={() => setActiveDrawer(null)} style={{ width: "26px", height: "26px" }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ flex: 1, minHeight: "340px", maxHeight: "460px", overflowY: "auto", background: "rgba(247, 251, 253, 0.7)", borderRadius: "12px", padding: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {!messages.length && (
                    <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "12px", margin: "auto 0" }}>
                      No messages yet. Send a message or question to the room.
                    </p>
                  )}
                  {messages.map(m => {
                    const isMine = m.sender_id === candidateId;
                    return (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: isMine ? "flex-end" : "flex-start",
                          maxWidth: "85%",
                          background: isMine ? "linear-gradient(135deg, #00537A, #013C58)" : "rgba(255, 255, 255, 0.95)",
                          color: isMine ? "#FFFFFF" : "var(--navy)",
                          border: isMine ? "none" : "1px solid rgba(0, 83, 122, 0.12)",
                          borderRadius: "12px",
                          padding: "8px 12px",
                          fontSize: "12px",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.04)"
                        }}
                      >
                        {!isMine && <b style={{ display: "block", fontSize: "10px", color: "var(--deep-blue)", marginBottom: "2px" }}>{m.sender_name}</b>}
                        <p style={{ margin: 0, wordBreak: "break-word" }}>{m.message}</p>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={sendMessage} style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    placeholder="Type a message to room..."
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "10px", fontSize: "12px" }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={!msgText.trim()}>
                    <Send size={14} />
                  </button>
                </form>
              </section>
            )}

            {activeDrawer === "participants" && (
              <section className="card" style={{ padding: "16px", height: "100%", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "14px", display: "flex", alignItems: "center", gap: "6px", color: "var(--navy)" }}>
                    <Users size={16} /> Participants ({allParticipants.length})
                  </h3>
                  <button type="button" className="icon-btn" onClick={() => setActiveDrawer(null)} style={{ width: "26px", height: "26px" }}>
                    <X size={14} />
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {allParticipants.map((p, idx) => (
                    <div
                      key={p.userId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 10px",
                        borderRadius: "10px",
                        background: p.isLocal ? "rgba(168, 232, 249, 0.25)" : "rgba(255, 255, 255, 0.7)",
                        border: "1px solid rgba(0, 83, 122, 0.1)"
                      }}
                    >
                      <div className="person-cell">
                        <span className="avatar" style={{ width: "30px", height: "30px", fontSize: "10px" }}>
                          <img
                            src={p.avatar || DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length]}
                            alt={p.name}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </span>
                        <div>
                          <b style={{ fontSize: "12px", color: "var(--navy)" }}>
                            {p.name} {p.isLocal ? "(You)" : ""}
                          </b>
                          <small style={{ color: "var(--muted)", display: "block", fontSize: "10px" }}>
                            {p.role === "interviewer" ? "Moderator" : "Candidate"} · {p.speakingTurns} turns
                          </small>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          className="icon-btn"
                          title={pinnedUserId === p.userId ? "Unpin video" : "Pin video to main stage"}
                          onClick={() => togglePinParticipant(p.userId)}
                          style={{
                            width: "28px",
                            height: "28px",
                            color: pinnedUserId === p.userId ? "var(--orange)" : "var(--muted)"
                          }}
                        >
                          {pinnedUserId === p.userId ? <PinOff size={13} /> : <Pin size={13} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
