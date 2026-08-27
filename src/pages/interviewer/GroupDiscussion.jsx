import { MessageCircle, Mic2, Users, Video, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";
import { api } from "../../lib/api";

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
];

export default function GroupDiscussion() {
  const [candidates, setCandidates] = useState([]);

  useEffect(() => {
    api.get("/profiles/candidates")
      .then(res => setCandidates(res.data || []))
      .catch(() => {});
  }, []);

  const participants = candidates.slice(0, 4).map((c, i) => ({
    name: c.full_name || "Candidate",
    photo: c.avatar_url || DEFAULT_AVATARS[i % DEFAULT_AVATARS.length],
    participation: [85, 92, 78, 88][i] || 80,
    isSpeaking: i === 0 || i === 1,
  }));

  return (
    <div>
      <SectionTitle
        eyebrow="GROUP DISCUSSION"
        title="Live group discussion"
        description="Monitor participation, communication clarity and turn-taking across group rounds."
        action={
          <Badge tone="danger">
            <span className="live-dot" /> Live
          </Badge>
        }
      />

      <div className="gd-grid">
        <section className="card gd-video">
          <div className="gd-toolbar">
            <span><Video size={16} /> {participants.length || 0} participants</span>
            <span><Volume2 size={16} /> Audio active</span>
            <Badge tone="info">Topic: Architecture & Scaling Strategies</Badge>
          </div>
          <div className="participant-grid">
            {participants.map(p => (
              <div
                className="participant"
                key={p.name}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "16px",
                  background: "linear-gradient(135deg, #1f1b1a, #2b2220)",
                  border: p.isSpeaking ? "1.5px solid var(--maroon)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  position: "relative",
                  boxShadow: p.isSpeaking ? "0 0 15px rgba(166, 94, 70, 0.25)" : "none"
                }}
              >
                {/* Header tag with Candidate Photo */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "50%", overflow: "hidden", border: "1.5px solid var(--maroon)", flex: "none" }}>
                      <img src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <span style={{ position: "static", fontSize: "13px", fontWeight: "700", color: "#fff" }}>
                      {p.name}
                    </span>
                  </div>
                  <span style={{ fontSize: "10px", background: p.isSpeaking ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.1)", color: p.isSpeaking ? "#4ade80" : "#9ca3af", padding: "3px 8px", borderRadius: "999px", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span className="live-dot" style={{ background: p.isSpeaking ? "#4ade80" : "#9ca3af" }} />
                    {p.isSpeaking ? "Speaking" : "Listening"}
                  </span>
                </div>

                {/* Center Audio Activity Visualizer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", height: "60px" }}>
                  {[18, 34, 48, 28, 42, 22, 38].map((h, idx) => (
                    <span
                      key={idx}
                      style={{
                        width: "4px",
                        height: p.isSpeaking ? `${h}px` : "8px",
                        background: p.isSpeaking ? "var(--maroon)" : "rgba(255,255,255,0.2)",
                        borderRadius: "2px",
                        transition: "height 0.2s ease"
                      }}
                    />
                  ))}
                </div>

                {/* Footer info */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <small style={{ position: "static", fontSize: "11px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Mic2 size={12} /> Mic active
                  </small>
                  <small style={{ position: "static", fontSize: "11px", color: "var(--maroon)", fontWeight: "700" }}>
                    {p.participation}% participation
                  </small>
                </div>
              </div>
            ))}
            {!participants.length && (
              <p className="empty-state">No candidates joined the session.</p>
            )}
          </div>
        </section>

        <aside className="card">
          <div className="card-head">
            <h3>Participation Metrics</h3>
            <Users size={18} />
          </div>
          {participants.map(p => (
            <div className="gd-person" key={p.name}>
              <span className="avatar" style={{ overflow: "hidden" }}>
                <img src={p.photo} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </span>
              <div>
                <b>{p.name}</b>
                <ProgressBar value={p.participation} />
              </div>
              <strong>{p.participation}%</strong>
            </div>
          ))}
          <div className="card-divider" />
          <div className="gd-signal">
            <MessageCircle size={18} />
            <div>
              <b>Speaking balance</b>
              <p>Balanced participant contributions observed across topics.</p>
            </div>
          </div>
          <div className="gd-signal">
            <Mic2 size={18} />
            <div>
              <b>Communication</b>
              <p>Clear turn-taking and active listening signals detected.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}