import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { api } from "./api";

const PEER_CONFIG = {
  debug: 0,
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  }
};

/**
 * Robust Multi-Participant WebRTC Mesh Hook for Group Discussion
 * Handles N-way audio/video, single-share screen sharing, active speaker detection,
 * speech-to-text, and Supabase presence/signaling.
 */
export function useGDWebRTC({
  discussionId,
  meetingRoomId,
  userId,
  userName,
  userAvatar,
  userRole = "candidate",
  enabled = true,
  onToast = () => {},
  onActivity = () => {},
  onTranscript = () => {},
}) {
  const roomId = meetingRoomId || discussionId;

  // Local Media
  const [localStream, setLocalStream] = useState(null);
  const [camera, setCamera] = useState(true);
  const [mic, setMic] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  // Screen Sharing
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreen, setRemoteScreen] = useState(null); // { stream, sharerId, sharerName }

  // Multi-Participant Streams & State
  const [remoteStreams, setRemoteStreams] = useState({}); // { [userId]: MediaStream }
  const [presenceMap, setPresenceMap] = useState({}); // { [userId]: participantMetadata }
  const [connected, setConnected] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState({}); // { [userId]: boolean }
  const [speakingMetrics, setSpeakingMetrics] = useState({}); // { [userId]: { turns, seconds } }

  // Refs for stable callbacks and teardown
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerRef = useRef(null);
  const peerIdRef = useRef("");
  const channelRef = useRef(null);
  const cameraCallsRef = useRef({}); // { [remotePeerId]: call }
  const screenCallsRef = useRef({}); // { [remotePeerId]: call }
  const audioContextRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const isSpeechListeningRef = useRef(false);
  const peerIdToUserIdMapRef = useRef({});

  // Explicit full cleanup function
  const cleanupMediaAndConnections = useCallback(() => {
    // 1. Stop local media tracks
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(t => {
          t.enabled = false;
          t.stop();
        });
      } catch {}
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setMediaReady(false);

    // 2. Stop screen sharing tracks
    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach(t => {
          t.enabled = false;
          t.stop();
        });
      } catch {}
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsSharingScreen(false);
    setRemoteScreen(null);

    // 3. Close peer calls and destroy PeerJS instance
    try {
      Object.values(cameraCallsRef.current).forEach(c => {
        try { c.close?.(); } catch {}
      });
      cameraCallsRef.current = {};
    } catch {}

    try {
      Object.values(screenCallsRef.current).forEach(c => {
        try { c.close?.(); } catch {}
      });
      screenCallsRef.current = {};
    } catch {}

    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch {}
      peerRef.current = null;
    }
    setConnected(false);
    setRemoteStreams({});
    setPresenceMap({});
    setActiveSpeakers({});

    // 4. Remove Supabase Channel
    if (channelRef.current) {
      try {
        channelRef.current.untrack().catch(() => {});
        supabase.removeChannel(channelRef.current);
      } catch {}
      channelRef.current = null;
    }

    // 5. Stop speech recognition
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch {}
      speechRecognitionRef.current = null;
    }
    isSpeechListeningRef.current = false;

    // 6. Close AudioContext
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try { audioContextRef.current.close().catch(() => {}); } catch {}
      audioContextRef.current = null;
    }
  }, []);

  // 1. Initialize Local Media (Camera + Mic)
  useEffect(() => {
    if (!enabled || !roomId || !userId) {
      if (!enabled && localStreamRef.current) {
        cleanupMediaAndConnections();
      }
      return;
    }
    let mounted = true;

    async function setupLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });

        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setMediaReady(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Could not access camera/microphone:", err);
        setMediaError(err.message || "Camera/Mic access denied");
        // Create an empty fallback stream if media denied so user can still connect
        const fallbackStream = new MediaStream();
        localStreamRef.current = fallbackStream;
        setLocalStream(fallbackStream);
        setMediaReady(true);
      }
    }

    setupLocalMedia();

    return () => {
      mounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [enabled, roomId, userId, cleanupMediaAndConnections]);

  // 2. Initialize PeerJS & Supabase Presence Channel
  useEffect(() => {
    if (!enabled || !roomId || !userId || !mediaReady) return;
    let isCleanedUp = false;

    async function initMesh() {
      try {
        const { default: Peer } = await import("peerjs");
        if (isCleanedUp) return;

        // Deterministic unique peer ID scoped to room and user
        const cleanRoom = roomId.replace(/[^a-zA-Z0-9_-]/g, "");
        const cleanUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 10);
        const myPeerId = `confira-gd-${cleanRoom}-${cleanUser}`;
        peerIdRef.current = myPeerId;
        peerIdToUserIdMapRef.current[myPeerId] = userId;

        const peer = new Peer(myPeerId, PEER_CONFIG);
        peerRef.current = peer;

        peer.on("open", () => {
          if (isCleanedUp) return;
          setConnected(true);

          // Connect Supabase Presence & Broadcast channel
          const channelName = `gd_room:${roomId}`;
          const channel = supabase.channel(channelName, {
            config: { presence: { key: userId } }
          });
          channelRef.current = channel;

          // Register Presence Listeners
          channel
            .on("presence", { event: "sync" }, () => {
              const state = channel.presenceState();
              const map = {};
              Object.keys(state).forEach(k => {
                const userObj = state[k]?.[0];
                if (userObj) {
                  map[k] = userObj;
                  if (userObj.peerId) {
                    peerIdToUserIdMapRef.current[userObj.peerId] = k;
                  }
                }
              });
              setPresenceMap(map);

              // Mesh call coordination: check all peers in room
              Object.values(map).forEach(remoteUser => {
                if (!remoteUser.peerId || remoteUser.userId === userId) return;
                const remotePeerId = remoteUser.peerId;

                // Deterministic caller: lexicographically smaller peer ID initiates call
                if (myPeerId < remotePeerId && !cameraCallsRef.current[remotePeerId]) {
                  initiateCameraCall(peer, remotePeerId, remoteUser.userId);
                }
              });
            })
            .on("presence", { event: "join" }, ({ key, newPresences }) => {
              const p = newPresences?.[0];
              if (!p) return;
              if (p.peerId) {
                peerIdToUserIdMapRef.current[p.peerId] = key;
              }
              setPresenceMap(prev => ({ ...prev, [key]: p }));

              if (p.name && key !== userId) {
                onToast(`${p.name} joined the discussion.`);
                onActivity(`${p.name} joined the discussion.`);
              }

              // Call newly joined peer if we are designated caller
              if (p.peerId && myPeerId < p.peerId && !cameraCallsRef.current[p.peerId]) {
                initiateCameraCall(peer, p.peerId, key);
              }

              // If we are currently sharing screen, send screen stream to new participant
              if (screenStreamRef.current && p.peerId) {
                callPeerWithScreen(peer, p.peerId);
              }
            })
            .on("presence", { event: "leave" }, ({ key }) => {
              setPresenceMap(prev => {
                const next = { ...prev };
                const leaving = next[key];
                if (leaving?.name && key !== userId) {
                  onActivity(`${leaving.name} left the discussion.`);
                }
                delete next[key];
                return next;
              });

              // Clean up remote stream
              setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[key];
                return next;
              });

              // If leaving user was sharing screen, clear remote screen
              setRemoteScreen(prev => (prev?.sharerId === key ? null : prev));
            })
            .on("broadcast", { event: "participant_media_updated" }, ({ payload }) => {
              if (payload?.userId) {
                setPresenceMap(prev => {
                  const curr = prev[payload.userId];
                  if (!curr) return prev;
                  return { ...prev, [payload.userId]: { ...curr, ...payload } };
                });
              }
            })
            .on("broadcast", { event: "screen_share_started" }, ({ payload }) => {
              if (payload?.sharerId && payload.sharerId !== userId) {
                onToast(`🟢 ${payload.sharerName || "A participant"} started screen sharing.`);
                onActivity(`${payload.sharerName || "A participant"} started screen sharing.`);
              }
            })
            .on("broadcast", { event: "screen_share_stopped" }, ({ payload }) => {
              if (payload?.sharerId && payload.sharerId !== userId) {
                onToast(`${payload.sharerName || "Participant"} stopped screen sharing.`);
                onActivity(`${payload.sharerName || "Participant"} stopped screen sharing.`);
                setRemoteScreen(prev => (prev?.sharerId === payload.sharerId ? null : prev));
              }
            })
            .on("broadcast", { event: "candidate_transcript" }, ({ payload }) => {
              if (payload?.text && payload.candidateId) {
                onTranscript(payload);
              }
            })
            .on("broadcast", { event: "speaker_speaking" }, ({ payload }) => {
              if (payload?.userId) {
                setActiveSpeakers(prev => ({ ...prev, [payload.userId]: payload.isSpeaking }));
              }
            })
            .subscribe(status => {
              if (status === "SUBSCRIBED") {
                channel.track({
                  userId,
                  peerId: myPeerId,
                  name: userName,
                  role: userRole,
                  avatar_url: userAvatar,
                  mic,
                  camera,
                  is_screen_sharing: false,
                  joined_at: new Date().toISOString()
                });
              }
            });
        });

        // Handle Incoming Calls
        peer.on("call", incomingCall => {
          const callType = incomingCall.metadata?.type || "camera";

          if (callType === "screen") {
            // Answer screen sharing stream without sending local media
            incomingCall.answer();
            screenCallsRef.current[incomingCall.peer] = incomingCall;

            incomingCall.on("stream", remoteScreenStream => {
              const sharerId = incomingCall.metadata?.sharerId || peerIdToUserIdMapRef.current[incomingCall.peer] || incomingCall.peer;
              const sharerName = incomingCall.metadata?.sharerName || "Participant";
              setRemoteScreen({
                stream: remoteScreenStream,
                sharerId,
                sharerName
              });
            });

            incomingCall.on("close", () => {
              delete screenCallsRef.current[incomingCall.peer];
              setRemoteScreen(prev => (prev?.sharerId === incomingCall.metadata?.sharerId ? null : prev));
            });
          } else {
            // Answer camera stream with local camera stream
            incomingCall.answer(localStreamRef.current);
            cameraCallsRef.current[incomingCall.peer] = incomingCall;

            incomingCall.on("stream", remoteStream => {
              const remoteUserId = incomingCall.metadata?.senderId || peerIdToUserIdMapRef.current[incomingCall.peer] || incomingCall.peer;
              setRemoteStreams(prev => ({
                ...prev,
                [remoteUserId]: remoteStream
              }));
            });

            incomingCall.on("close", () => {
              delete cameraCallsRef.current[incomingCall.peer];
              const rUid = peerIdToUserIdMapRef.current[incomingCall.peer] || incomingCall.peer;
              setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[rUid];
                return next;
              });
            });
          }
        });

        peer.on("error", err => {
          console.warn("PeerJS error:", err.type, err.message);
          if (err.type === "peer-unavailable") {
            // Remote peer not yet available or closed, safe to ignore
          }
        });
      } catch (err) {
        console.error("Failed to initialize Peer mesh:", err);
      }
    }

    initMesh();

    return () => {
      isCleanedUp = true;
      if (channelRef.current) {
        channelRef.current.untrack().catch(() => {});
        supabase.removeChannel(channelRef.current);
      }
      Object.values(cameraCallsRef.current).forEach(c => c.close?.());
      Object.values(screenCallsRef.current).forEach(c => c.close?.());
      if (peerRef.current) {
        peerRef.current.destroy();
      }
    };
  }, [roomId, userId, mediaReady, userName, userAvatar, userRole]);

  // Helper: Initiate camera call to remote peer
  const initiateCameraCall = useCallback((peer, remotePeerId, targetUserId) => {
    if (!peer || !localStreamRef.current || cameraCallsRef.current[remotePeerId]) return;

    try {
      const call = peer.call(remotePeerId, localStreamRef.current, {
        metadata: {
          type: "camera",
          senderId: userId,
          senderName: userName,
          senderRole: userRole
        }
      });

      if (call) {
        cameraCallsRef.current[remotePeerId] = call;

        call.on("stream", remoteStream => {
          setRemoteStreams(prev => ({
            ...prev,
            [targetUserId]: remoteStream
          }));
        });

        call.on("close", () => {
          delete cameraCallsRef.current[remotePeerId];
          setRemoteStreams(prev => {
            const next = { ...prev };
            delete next[targetUserId];
            return next;
          });
        });
      }
    } catch (e) {
      console.warn("Failed to call remote peer:", remotePeerId, e);
    }
  }, [userId, userName, userRole]);

  // Helper: Call peer with screen stream
  const callPeerWithScreen = useCallback((peer, remotePeerId) => {
    if (!peer || !screenStreamRef.current) return;
    try {
      const call = peer.call(remotePeerId, screenStreamRef.current, {
        metadata: {
          type: "screen",
          sharerId: userId,
          sharerName: userName
        }
      });
      if (call) {
        screenCallsRef.current[remotePeerId] = call;
      }
    } catch (e) {
      console.warn("Failed to send screen stream to peer:", remotePeerId, e);
    }
  }, [userId, userName]);

  // 3. Media Controls (Camera & Mic)
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const next = !camera;
      videoTracks.forEach(t => { t.enabled = next; });
      setCamera(next);

      // Broadcast state update
      channelRef.current?.send({
        type: "broadcast",
        event: "participant_media_updated",
        payload: { userId, camera: next, mic }
      });
    } else {
      setCamera(prev => !prev);
    }
  }, [camera, mic, userId]);

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const next = !mic;
      audioTracks.forEach(t => { t.enabled = next; });
      setMic(next);

      // Broadcast state update
      channelRef.current?.send({
        type: "broadcast",
        event: "participant_media_updated",
        payload: { userId, camera, mic: next }
      });
    } else {
      setMic(prev => !prev);
    }
  }, [camera, mic, userId]);

  // 4. Screen Sharing Implementation
  const startScreenShare = useCallback(async () => {
    // Check single sharer lock across presence / remoteScreen
    if (remoteScreen && remoteScreen.sharerId !== userId) {
      onToast(`⚠️ ${remoteScreen.sharerName || "Another participant"} is currently sharing their screen.`);
      return false;
    }

    const anyOtherSharing = Object.values(presenceMap).some(
      p => p.userId !== userId && p.is_screen_sharing
    );
    if (anyOtherSharing) {
      const otherSharer = Object.values(presenceMap).find(p => p.userId !== userId && p.is_screen_sharing);
      onToast(`⚠️ ${otherSharer?.name || "Another participant"} is currently sharing their screen.`);
      return false;
    }

    if (!navigator.mediaDevices?.getDisplayMedia) {
      onToast("❌ Screen sharing is not supported in this browser.");
      return false;
    }

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "default", frameRate: { ideal: 30 } },
        audio: false
      });

      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setIsSharingScreen(true);
      setRemoteScreen({
        stream: displayStream,
        sharerId: userId,
        sharerName: userName
      });

      // Handle native screen share stop (browser bar stop button)
      const videoTrack = displayStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      // Stream to all connected peers in the mesh
      if (peerRef.current) {
        Object.values(presenceMap).forEach(remoteUser => {
          if (remoteUser.peerId && remoteUser.userId !== userId) {
            callPeerWithScreen(peerRef.current, remoteUser.peerId);
          }
        });
      }

      // Broadcast screen share started
      channelRef.current?.send({
        type: "broadcast",
        event: "screen_share_started",
        payload: { sharerId: userId, sharerName: userName }
      });

      // Update presence
      channelRef.current?.track({
        userId,
        peerId: peerIdRef.current,
        name: userName,
        role: userRole,
        avatar_url: userAvatar,
        mic,
        camera,
        is_screen_sharing: true
      });

      onToast("🖥 You started screen sharing.");
      onActivity(`${userName} started screen sharing.`);
      return true;
    } catch (err) {
      if (err.name === "NotAllowedError") {
        onToast("Screen sharing permission was denied.");
      } else if (err.name === "AbortError") {
        onToast("Screen sharing was cancelled.");
      } else if (err.name === "NotFoundError" || err.name === "NotReadableError") {
        onToast("Unable to share your screen.");
      } else {
        onToast(`Screen share error: ${err.message || "Failed to start"}`);
      }
      return false;
    }
  }, [remoteScreen, presenceMap, userId, userName, userRole, userAvatar, mic, camera, onToast, onActivity, callPeerWithScreen]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsSharingScreen(false);
    setRemoteScreen(prev => (prev?.sharerId === userId ? null : prev));

    // Close screen calls
    Object.values(screenCallsRef.current).forEach(c => c.close?.());
    screenCallsRef.current = {};

    // Broadcast screen share stopped
    channelRef.current?.send({
      type: "broadcast",
      event: "screen_share_stopped",
      payload: { sharerId: userId, sharerName: userName }
    });

    // Update presence
    channelRef.current?.track({
      userId,
      peerId: peerIdRef.current,
      name: userName,
      role: userRole,
      avatar_url: userAvatar,
      mic,
      camera,
      is_screen_sharing: false
    });

    onToast("Screen sharing stopped.");
    onActivity(`${userName} stopped screen sharing.`);
  }, [userId, userName, userRole, userAvatar, mic, camera, onToast, onActivity]);

  // 5. Audio Level / Speaking Detection with Web Audio API
  useEffect(() => {
    if (!localStream || !mic) {
      setActiveSpeakers(prev => ({ ...prev, [userId]: false }));
      return;
    }

    let audioContext = null;
    let analyser = null;
    let source = null;
    let intervalId = null;
    let isSpeakingLocal = false;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;

      source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let consecutiveSpeakingCount = 0;

      intervalId = setInterval(() => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // Reasonable speaking threshold
        const speakingNow = average > 22;

        if (speakingNow) {
          consecutiveSpeakingCount++;
        } else {
          consecutiveSpeakingCount = Math.max(0, consecutiveSpeakingCount - 1);
        }

        // Only register as speaking if continuous for at least 2 samples (500ms) to filter clicks/coughs
        const isStableSpeaking = consecutiveSpeakingCount >= 2;

        if (isStableSpeaking !== isSpeakingLocal) {
          isSpeakingLocal = isStableSpeaking;
          setActiveSpeakers(prev => ({ ...prev, [userId]: isStableSpeaking }));

          channelRef.current?.send({
            type: "broadcast",
            event: "speaker_speaking",
            payload: { userId, isSpeaking: isStableSpeaking }
          });

          if (isStableSpeaking) {
            setSpeakingMetrics(prev => {
              const cur = prev[userId] || { turns: 0, seconds: 0 };
              return { ...prev, [userId]: { ...cur, turns: cur.turns + 1 } };
            });
          }
        }

        if (isStableSpeaking) {
          setSpeakingMetrics(prev => {
            const cur = prev[userId] || { turns: 1, seconds: 0 };
            return { ...prev, [userId]: { ...cur, seconds: cur.seconds + 0.25 } };
          });
        }
      }, 250);
    } catch (e) {
      console.warn("Audio level detection unavailable:", e);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
    };
  }, [localStream, mic, userId]);

  // 6. Speech-to-Text Transcription via Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition || !mic) {
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.stop(); } catch {}
      }
      isSpeechListeningRef.current = false;
      return;
    }

    let recognition = null;
    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      speechRecognitionRef.current = recognition;

      recognition.onresult = event => {
        const lastIndex = event.results.length - 1;
        const transcriptText = event.results[lastIndex]?.[0]?.transcript?.trim();
        if (transcriptText) {
          const payload = {
            candidateId: userId,
            candidate_id: userId,
            speakerName: userName,
            speaker_name: userName,
            text: transcriptText,
            transcript: transcriptText,
            timestamp: new Date().toISOString(),
            duration_seconds: 5
          };

          onTranscript(payload);

          // Broadcast transcript event
          channelRef.current?.send({
            type: "broadcast",
            event: "candidate_transcript",
            payload
          });

          // Post transcript to backend
          if (discussionId) {
            api.post(`/group-discussions/${discussionId}/transcripts`, payload).catch(() => {});
          }
        }
      };

      recognition.onerror = err => {
        if (err.error !== "no-speech") {
          console.warn("Speech recognition notice:", err.error);
        }
      };

      recognition.onend = () => {
        if (isSpeechListeningRef.current && mic) {
          try { recognition.start(); } catch {}
        }
      };

      recognition.start();
      isSpeechListeningRef.current = true;
    } catch (e) {
      console.warn("Speech recognition could not be initialized:", e);
    }

    return () => {
      isSpeechListeningRef.current = false;
      if (recognition) {
        try { recognition.stop(); } catch {}
      }
    };
  }, [mic, userId, userName, discussionId, onTranscript]);

  return {
    // Local Media
    localStream,
    localVideoRef,
    camera,
    mic,
    toggleCamera,
    toggleMic,
    mediaReady,
    mediaError,

    // Screen Sharing
    isSharingScreen,
    screenStream,
    remoteScreen,
    startScreenShare,
    stopScreenShare,

    // Remote Streams & Presence
    remoteStreams,
    presenceMap,
    connected,
    activeSpeakers,
    speakingMetrics,
    channelRef,
    cleanupMediaAndConnections,
  };
}
