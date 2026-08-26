import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, ShieldAlert, Activity, Users, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import ChatBox from "../../components/ChatBox";
import { api } from "../../lib/api";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function LiveInterviewRoom() {
  const localVideo = useRef(null);
  const candidateVideo = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([
    { level: "success", text: "Interviewer room opened" },
    { level: "info", text: "Waiting for candidate to join" }
  ]);
  const [roomId] = useState(() => new URLSearchParams(window.location.search).get("room") || "demo-room");
  const candidateId = new URLSearchParams(window.location.search).get("candidate");
  const [candidate, setCandidate] = useState({ full_name: "Candidate", headline: "" });
  useEffect(() => { if (candidateId) api.get("/profiles/candidates").then(result => { const match = (result.data || []).find(item => item.id === candidateId); if (match) setCandidate(match); }).catch(() => {}); }, [candidateId]);
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

        const peer = new Peer(`interviewer-${roomId}-${Math.random().toString(36).slice(2, 8)}`, {
          host: window.location.hostname,
          port: window.location.port || undefined,
          path: "/peerjs",
          secure: window.location.protocol === "https:"
        });
        peerRef.current = peer;

        peer.on("open", peerId => {
          socket.emit("join-interview", { room_id: roomId, role: "interviewer", peer_id: peerId });
          addEvent("info", "Interviewer connected to signaling room");
        });

        socket.on("candidate-joined", ({ peer_id }) => {
          addEvent("success", "Candidate joined the interview");
          const call = peer.call(peer_id, stream);
          call.on("stream", remoteStream => {
            candidateVideo.current.srcObject = remoteStream;
            setConnected(true);
            addEvent("success", "Live audio/video connected");
          });
        });

        peer.on("call", call => {
          call.answer(stream);
          call.on("stream", remoteStream => {
            candidateVideo.current.srcObject = remoteStream;
            setConnected(true);
            addEvent("success", "Candidate video received");
          });
        });
      } catch (err) {
        console.error(err);
        addEvent("critical", "Camera/microphone permission is required");
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

  function addEvent(level, text) {
    setEvents(e => [{ level, text, time: new Date().toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"}) }, ...e].slice(0, 20));
  }
  function toggleMic() {
    const next = !mic; setMic(next);
    localVideo.current?.srcObject?.getAudioTracks().forEach(t => t.enabled = next);
  }
  function toggleCamera() {
    const next = !camera; setCamera(next);
    localVideo.current?.srcObject?.getVideoTracks().forEach(t => t.enabled = next);
  }
  function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({ video: true }).then(screen => {
      addEvent("info", "Interviewer screen sharing started");
      screen.getVideoTracks()[0].onended = () => addEvent("info", "Interviewer screen sharing stopped");
    }).catch(() => {});
  }

  return <div className="live-room interviewer-room">
    <header className="live-room-header">
      <div><span className="live-pill"><span className="live-dot"/> LIVE</span><h1>Live Interview Monitor</h1><p>{candidate.headline || "Interview"} · Candidate: {candidate.full_name} · Room: {roomId}</p></div>
      <div className="live-status"><Activity size={16}/> {connected ? "Candidate connected" : "Waiting for candidate"}</div>
    </header>

    <main className="live-stage">
      <section className="video-stage">
        <div className="remote-video-panel">
          <video ref={candidateVideo} autoPlay playsInline className="live-video" />
          {!connected && <div className="video-placeholder"><Users size={42}/><b>Waiting for candidate</b><span>Ask the candidate to open their Join Interview link.</span></div>}
          <span className="video-tag">{candidate.full_name.toUpperCase()}</span>
        </div>
        <div className="local-video-panel">
          <video ref={localVideo} autoPlay muted playsInline className="live-video"/>
          <span className="video-tag">INTERVIEWER</span>
        </div>
        <div className="live-controls">
          <button onClick={toggleMic} className={`round-control ${mic ? "" : "off"}`}>{mic?<Mic/>:<MicOff/>}</button>
          <button onClick={toggleCamera} className={`round-control ${camera ? "" : "off"}`}>{camera?<Video/>:<VideoOff/>}</button>
          <button onClick={shareScreen} className="round-control"><MonitorUp/></button>
          <Link to="/interviewer/dashboard" className="end-call"><PhoneOff size={18}/> End interview</Link>
        </div>
      </section>

      <aside className="activity-rail live-activity-rail">
        <div className="card activity-card">
          <div className="card-head"><div><h3>Candidate activity</h3><p>Real-time monitoring</p></div><span className="live-pill small"><span className="live-dot"/> LIVE</span></div>
          <div className="activity-summary"><div><b>{events.filter(e=>e.level==="critical").length}</b><span>Critical</span></div><div><b>{events.length}</b><span>Events</span></div><div><b>{connected ? "ON" : "WAIT"}</b><span>Video</span></div></div>
          <div className="activity-feed">
            {events.map((e,i)=><div className={`activity-event ${e.level}`} key={i}><span className="activity-event-icon">{e.level==="critical"||e.level==="warning"?<ShieldAlert size={15}/>:e.level==="success"?<Users size={15}/>:<Activity size={15}/>}</span><div className="activity-event-body"><div><b>{e.text}</b><time>{e.time || "now"}</time></div></div></div>)}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>Integrity alerts</h3><ShieldAlert size={18}/></div>
          <div className="integrity-alert"><AlertTriangle size={16}/><div><b>Monitoring enabled</b><p>Connect the backend activity detector to stream tab-switch, focus, camera and screen-share alerts here.</p></div></div>
        </div>
        <ChatBox roomId={roomId} sender="Interviewer" />
      </aside>
    </main>
  </div>;
}
