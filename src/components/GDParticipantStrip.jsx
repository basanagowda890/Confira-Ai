import { useRef } from "react";
import { Mic, MicOff, VideoOff, Pin, PinOff, Monitor, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";

export default function GDParticipantStrip({
  participants = [],
  activeSpeakerId = null,
  pinnedUserId = null,
  onSelectParticipant = () => {},
  onTogglePin = () => {},
  mainStageUserIds = [],
}) {
  const stripRef = useRef(null);

  const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  function scroll(offset) {
    if (stripRef.current) {
      stripRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  }

  if (!participants.length) return null;

  return (
    <div style={{ position: "relative", width: "100%", margin: "14px 0 6px" }}>
      {/* Header bar for strip */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", padding: "0 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--maroon)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            ALL PARTICIPANTS ({participants.length})
          </span>
          <span style={{ fontSize: "11px", color: "var(--muted)" }}>
            · Click any participant to focus / pin in main stage
          </span>
        </div>

        {/* Scroll Buttons if strip is wide */}
        {participants.length > 4 && (
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => scroll(-240)}
              className="btn btn-outline btn-sm"
              style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px" }}
              title="Scroll left"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => scroll(240)}
              className="btn btn-outline btn-sm"
              style={{ width: "26px", height: "26px", padding: 0, borderRadius: "6px" }}
              title="Scroll right"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Horizontally Scrollable Participant Strip */}
      <div
        ref={stripRef}
        style={{
          display: "flex",
          gap: "10px",
          overflowX: "auto",
          paddingBottom: "8px",
          paddingTop: "2px",
          scrollbarWidth: "thin",
          scrollSnapType: "x mandatory"
        }}
      >
        {participants.map((p) => {
          const isSpeaking = p.isSpeaking || activeSpeakerId === p.userId;
          const isPinned = pinnedUserId === p.userId;
          const isInMainStage = mainStageUserIds.includes(p.userId);

          return (
            <div
              key={p.userId}
              onClick={() => onSelectParticipant(p.userId)}
              style={{
                flex: "0 0 auto",
                width: "150px",
                background: isPinned ? "rgba(168, 232, 249, 0.3)" : isSpeaking ? "rgba(255, 211, 91, 0.25)" : "rgba(255, 255, 255, 0.75)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                border: isPinned
                  ? "2px solid #00537A"
                  : isSpeaking
                  ? "2px solid #FFBA42"
                  : isInMainStage
                  ? "1.5px solid rgba(0, 83, 122, 0.25)"
                  : "1px solid rgba(0, 83, 122, 0.12)",
                borderRadius: "14px",
                padding: "8px",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s ease",
                boxShadow: isSpeaking
                  ? "0 0 12px rgba(255, 186, 66, 0.35)"
                  : "0 4px 14px rgba(1, 60, 88, 0.06)",
                scrollSnapAlign: "start",
                userSelect: "none"
              }}
            >
              {/* Mini Avatar / Video Preview Container */}
              <div
                style={{
                  position: "relative",
                  height: "70px",
                  background: "linear-gradient(145deg, #012B3F, #013C58)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  display: "grid",
                  placeItems: "center",
                  marginBottom: "6px"
                }}
              >
                {/* Live stream preview if camera enabled */}
                {p.isCameraOn && p.stream ? (
                  <video
                    ref={(el) => {
                      if (el && p.stream && el.srcObject !== p.stream) {
                        el.srcObject = p.stream;
                      }
                    }}
                    autoPlay
                    playsInline
                    muted={p.isLocal}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      transform: p.isLocal ? "scaleX(-1)" : "none"
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: isSpeaking ? "2px solid #22c55e" : "1.5px solid rgba(255,255,255,0.2)"
                    }}
                  >
                    <img
                      src={p.avatar || defaultAvatar}
                      alt={p.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}

                {/* Top left badge */}
                {p.isLocal && (
                  <span style={{ position: "absolute", top: "4px", left: "4px", background: "rgba(0,0,0,0.7)", color: "#fff", padding: "1px 5px", borderRadius: "4px", fontSize: "8px", fontWeight: "800" }}>
                    YOU
                  </span>
                )}
                {p.role === "interviewer" && !p.isLocal && (
                  <span style={{ position: "absolute", top: "4px", left: "4px", background: "var(--maroon)", color: "#fff", padding: "1px 5px", borderRadius: "4px", fontSize: "8px", fontWeight: "800" }}>
                    MOD
                  </span>
                )}

                {/* Pin Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(p.userId);
                  }}
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    background: isPinned ? "var(--maroon)" : "rgba(0,0,0,0.6)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    width: "20px",
                    height: "20px",
                    display: "grid",
                    placeItems: "center",
                    cursor: "pointer"
                  }}
                  title={isPinned ? "Unpin participant" : "Pin participant to main stage"}
                >
                  {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
                </button>

                {/* Speaking indicator waves */}
                {isSpeaking && (
                  <div style={{ position: "absolute", bottom: "4px", left: "4px", display: "flex", gap: "2px", alignItems: "flex-end", height: "10px" }}>
                    {[6, 12, 8, 14].map((h, i) => (
                      <span key={i} style={{ width: "2px", height: `${h}px`, background: "#22c55e", borderRadius: "1px" }} />
                    ))}
                  </div>
                )}

                {/* Screen Share Icon */}
                {p.isScreenSharing && (
                  <span style={{ position: "absolute", bottom: "4px", left: "4px", background: "#22c55e", color: "#fff", padding: "1px 4px", borderRadius: "3px", fontSize: "8px", display: "flex", alignItems: "center", gap: "2px" }}>
                    <Monitor size={9} /> Screen
                  </span>
                )}

                {/* Mic status indicator */}
                <div style={{ position: "absolute", bottom: "4px", right: "4px" }}>
                  {p.isMicOn ? (
                    <span style={{ background: "rgba(22, 163, 74, 0.85)", color: "#fff", padding: "2px 4px", borderRadius: "4px", fontSize: "8px", display: "flex", alignItems: "center" }}>
                      <Mic size={9} />
                    </span>
                  ) : (
                    <span style={{ background: "rgba(239, 68, 68, 0.9)", color: "#fff", padding: "2px 4px", borderRadius: "4px", fontSize: "8px", display: "flex", alignItems: "center" }}>
                      <MicOff size={9} />
                    </span>
                  )}
                </div>
              </div>

              {/* Name & Speaking Status */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "90px" }}>
                  {p.name}
                </span>
                {isInMainStage && (
                  <span style={{ fontSize: "9px", color: "var(--maroon)", fontWeight: "800" }}>
                    Stage
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
