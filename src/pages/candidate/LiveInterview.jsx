import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, ShieldCheck, Users, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function LiveInterview() {
  const localVideo = useRef(null);
  const remoteVideo = useRef(null);
  const peerRef = useRef(null);
  const socketRef = useRef(null);
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState("Connecting to interview room...");
  const [roomId] = useState(() => new URLSearchParams(window.location.search).get("room") || "demo-room");

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

        const peer = new Peer(`candidate-${roomId}-${Math.random().toString(36).slice(2, 8)}`, {
          host: window.location.hostname,
          port: window.location.port || undefined,
          path: "/peerjs",
          secure: window.location.protocol === "https:"
        });
        peerRef.current = peer;

        peer.on("open", peerId => {
          socket.emit("join-interview", { room_id: roomId, role: "candidate", peer_id: peerId });
          setStatus("Waiting for interviewer...");
        });

        peer.on("call", call => {
          call.answer(stream);
          call.on("stream", remoteStream => {
            remoteVideo.current.srcObject = remoteStream;
            setConnected(true);
            setStatus("Live interview connected");
          });
        });

        socket.on("interviewer-joined", ({ peer_id }) => {
          setStatus("Interviewer joined — connecting...");
          const call = peer.call(peer_id, stream);
          call.on("stream", remoteStream => {
            remoteVideo.current.srcObject = remoteStream;
            setConnected(true);
            setStatus("Live interview connected");
          });
        });
      } catch (err) {
        console.error(err);
        setStatus("Camera/microphone permission is required.");
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

  function toggleMic() {
    const next = !mic;
    setMic(next);
    const stream = localVideo.current?.srcObject;
    stream?.getAudioTracks().forEach(t => { t.enabled = next; });
  }

  function toggleCamera() {
    const next = !camera;
    setCamera(next);
    const stream = localVideo.current?.srcObject;
    stream?.getVideoTracks().forEach(t => { t.enabled = next; });
  }

  async function shareScreen() {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screen.getVideoTracks()[0];
      const stream = localVideo.current?.srcObject;
      const old = stream?.getVideoTracks()[0];
      if (stream) {
        if (old) stream.removeTrack(old);
        stream.addTrack(videoTrack);
        localVideo.current.srcObject = stream;
      }
      videoTrack.onended = () => setCamera(true);
    } catch (e) {
      console.log("Screen sharing cancelled.");
    }
  }

  return <div className="live-room">
    <header className="live-room-header">
      <div>
        <span className="live-pill"><span className="live-dot" /> LIVE</span>
        <h1>Frontend Developer Interview</h1>
        <p>Candidate: Basana Gowda · Room: {roomId}</p>
      </div>
      <div className="live-status"><ShieldCheck size={16} /> {status}</div>
    </header>

    <main className="live-stage">
      <section className="video-stage">
        <div className="remote-video-panel">
          <video ref={remoteVideo} autoPlay playsInline className="live-video" />
          {!connected && <div className="video-placeholder"><Users size={42}/><b>Waiting for interviewer</b><span>The interviewer will appear here when they join.</span></div>}
          <span className="video-tag">INTERVIEWER</span>
        </div>

        <div className="local-video-panel">
          <video ref={localVideo} autoPlay muted playsInline className="live-video" />
          <span className="video-tag">YOU</span>
        </div>

        <div className="live-controls">
          <button onClick={toggleMic} className={`round-control ${mic ? "" : "off"}`} title={mic ? "Mute" : "Unmute"}>{mic ? <Mic/> : <MicOff/>}</button>
          <button onClick={toggleCamera} className={`round-control ${camera ? "" : "off"}`} title={camera ? "Turn camera off" : "Turn camera on"}>{camera ? <Video/> : <VideoOff/>}</button>
          <button onClick={shareScreen} className="round-control" title="Share screen"><MonitorUp/></button>
          <Link to="/candidate/dashboard" className="end-call"><PhoneOff size={18}/> Leave interview</Link>
        </div>
      </section>

      <aside className="live-side-panel">
        <div className="live-side-card">
          <div className="live-side-title"><MessageSquare size={18}/><b>Interview chat</b></div>
          <div className="chat-empty">Chat can be used for interview instructions and technical issues.</div>
          <input placeholder="Message interviewer..." />
        </div>
        <div className="live-side-card">
          <div className="live-side-title"><ShieldCheck size={18}/><b>Interview integrity</b></div>
          <div className="integrity-row"><span>Camera</span><b>Active</b></div>
          <div className="integrity-row"><span>Microphone</span><b>Active</b></div>
          <div className="integrity-row"><span>Screen sharing</span><b>Available</b></div>
          <p className="integrity-note">Your interview activity may be monitored according to the company's interview policy.</p>
        </div>
      </aside>
    </main>
  </div>;
}
