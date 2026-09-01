import { useRef, useEffect, useState } from "react";
import { Maximize2, Minimize2, Monitor, StopCircle } from "lucide-react";

export default function GDScreenViewer({
  screenStream,
  sharerName = "Participant",
  isLocalSharer = false,
  onStopShare = () => {},
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => {
    function handleFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.warn("Fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  if (!screenStream) return null;

  return (
    <div
      ref={containerRef}
      className="card"
      style={{
        background: "#0c0a09",
        color: "#fff",
        borderRadius: "14px",
        overflow: "hidden",
        border: "2px solid #22c55e",
        marginBottom: "18px",
        position: "relative",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)"
      }}
    >
      {/* Screen Share Header Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 16px",
          background: "rgba(24, 24, 27, 0.95)",
          borderBottom: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="live-dot" style={{ background: "#22c55e" }} />
          <Monitor size={16} color="#22c55e" />
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>
            {isLocalSharer ? "You are sharing your screen" : `${sharerName} is sharing screen`}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isLocalSharer && (
            <button
              onClick={onStopShare}
              className="btn btn-danger btn-sm"
              style={{ padding: "4px 10px", fontSize: "11px", display: "flex", alignItems: "center", gap: "5px" }}
            >
              <StopCircle size={13} /> Stop Sharing
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="btn btn-outline btn-sm"
            style={{
              padding: "4px 10px",
              fontSize: "11px",
              color: "#fff",
              borderColor: "rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {/* Screen Video Container */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: isFullscreen ? "calc(100vh - 50px)" : "420px",
          background: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#000"
          }}
        />
      </div>
    </div>
  );
}
