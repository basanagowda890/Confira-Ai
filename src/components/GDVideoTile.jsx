import { useEffect, useRef } from "react";
import { Mic, MicOff, VideoOff, Pin, PinOff } from "lucide-react";

export default function GDVideoTile({
  stream,
  name = "Participant",
  role = "candidate",
  avatar,
  isLocal = false,
  isCameraOn = true,
  isMicOn = true,
  isSpeaking = false,
  isCurrentSpeaker = false,
  isPinned = false,
  onTogglePin = null,
  speakingTurns = 0,
  stageSize = "grid", // "single" | "dual" | "grid"
  actionButton = null,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  // Calculate height based on Google Meet stage layout
  const tileHeight = stageSize === "single" ? "440px" : stageSize === "dual" ? "280px" : "200px";

  return (
    <div
      style={{
        position: "relative",
        height: tileHeight,
        width: "100%",
        background: "linear-gradient(145deg, #012B3F, #013C58)",
        borderRadius: "18px",
        overflow: "hidden",
        border: isSpeaking || isCurrentSpeaker ? "3px solid #FFBA42" : isPinned ? "2.5px solid #A8E8F9" : "1px solid rgba(0,83,122,0.3)",
        boxShadow: isSpeaking
          ? "0 0 25px rgba(255, 186, 66, 0.45)"
          : "0 8px 24px rgba(1,60,88,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
    >
      {/* Live Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: isCameraOn && stream ? "block" : "none",
          transform: isLocal ? "scaleX(-1)" : "none"
        }}
      />

      {/* Camera Off Avatar Screen */}
      {(!isCameraOn || !stream) && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            color: "#e5e7eb"
          }}
        >
          <div
            style={{
              width: stageSize === "single" ? "100px" : stageSize === "dual" ? "76px" : "56px",
              height: stageSize === "single" ? "100px" : stageSize === "dual" ? "76px" : "56px",
              borderRadius: "50%",
              overflow: "hidden",
              border: isSpeaking ? "3.5px solid #FFBA42" : "2.5px solid rgba(168,232,249,0.5)",
              boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
            }}
          >
            <img
              src={avatar || defaultAvatar}
              alt={name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <span style={{ fontSize: "11px", color: "#A8E8F9", display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
            <VideoOff size={13} /> Camera Off
          </span>
        </div>
      )}

      {/* Top Left Badges: Role & Moderator */}
      <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", gap: "6px", alignItems: "center", zIndex: 2 }}>
        {isLocal && (
          <span style={{ background: "rgba(1,60,88,0.85)", backdropFilter: "blur(8px)", color: "#A8E8F9", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800", border: "1px solid rgba(168,232,249,0.25)" }}>
            YOU {role === "interviewer" ? "(MODERATOR)" : ""}
          </span>
        )}
        {role === "interviewer" && !isLocal && (
          <span style={{ background: "linear-gradient(135deg, #00537A, #013C58)", color: "#FFD35B", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: "800", border: "1px solid rgba(255,211,91,0.3)" }}>
            MODERATOR
          </span>
        )}
        {speakingTurns > 0 && (
          <span style={{ background: "rgba(1,60,88,0.75)", color: "#e5e7eb", padding: "3px 7px", borderRadius: "6px", fontSize: "9px", fontWeight: "600" }}>
            {speakingTurns} turns
          </span>
        )}
      </div>

      {/* Top Right: Pin & Speaking Status */}
      <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "6px", alignItems: "center", zIndex: 2 }}>
        {(isSpeaking || isCurrentSpeaker) && (
          <span
            style={{
              background: "linear-gradient(135deg, #F5A201, #FFBA42)",
              color: "#013C58",
              padding: "3px 9px",
              borderRadius: "6px",
              fontSize: "10px",
              fontWeight: "800",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 2px 10px rgba(245, 162, 1, 0.45)"
            }}
          >
            <span className="live-dot" style={{ background: "#013C58" }} /> SPEAKING
          </span>
        )}

        {onTogglePin && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            style={{
              background: isPinned ? "linear-gradient(135deg, #00537A, #013C58)" : "rgba(1,60,88,0.75)",
              backdropFilter: "blur(6px)",
              color: isPinned ? "#FFD35B" : "#fff",
              border: "1px solid rgba(168,232,249,0.25)",
              borderRadius: "6px",
              width: "28px",
              height: "28px",
              display: "grid",
              placeItems: "center",
              cursor: "pointer"
            }}
            title={isPinned ? "Unpin participant" : "Pin participant to main stage"}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
        )}
      </div>

      {/* Bottom Floating Info Pill (Google Meet Style) */}
      <div
        style={{
          position: "absolute",
          bottom: "10px",
          left: "10px",
          right: "10px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 2
        }}
      >
        <div
          style={{
            background: "rgba(1, 40, 60, 0.85)",
            backdropFilter: "blur(10px)",
            color: "#fff",
            padding: "4px 10px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: "700",
            maxWidth: "75%",
            border: "1px solid rgba(168, 232, 249, 0.2)"
          }}
        >
          {isMicOn ? (
            <span style={{ color: "#A8E8F9", display: "flex", alignItems: "center" }}>
              <Mic size={13} />
            </span>
          ) : (
            <span style={{ color: "#F5A201", display: "flex", alignItems: "center" }}>
              <MicOff size={13} />
            </span>
          )}
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {name}
          </span>
        </div>

        {/* Action Button (e.g. Give Turn to Speak) */}
        {actionButton && (
          <div>
            {actionButton}
          </div>
        )}
      </div>
    </div>
  );
}
