import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

export default function ChatBox({ roomId, meetingRoomId, sender, currentUserName }) {
  const actualRoomId = roomId || meetingRoomId || "demo-room";
  const actualSender = sender || currentUserName || "Interviewer";
  const storageKey = `confira-chat-${actualRoomId}`;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const channelRef = useRef(null);

  useEffect(() => {
    const receive = event => setMessages(current => current.some(item => item.id === event.payload.id) ? current : [...current, event.payload]);
    const channel = supabase?.channel(storageKey);
    channelRef.current = channel;
    channel?.on("broadcast", { event: "message" }, receive).subscribe();
    return () => {
      if (channel) supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [storageKey]);

  function sendMessage(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    const next = [...messages, { id: `${Date.now()}-${Math.random()}`, sender: actualSender, text: value, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }];
    setMessages(next);
    channelRef.current?.send({ type: "broadcast", event: "message", payload: next[next.length - 1] });
    setText("");
  }

  return <section className="chat-box" aria-label="Shared interview chat">
    <div className="chat-box-head"><div><h3><MessageSquare size={16} /> Interview chat</h3><p>Shared with the {sender === "Candidate" ? "interviewer" : "candidate"}</p></div><span className="chat-live">LIVE</span></div>
    <div className="chat-messages" aria-live="polite">
      {!messages.length && <p className="chat-placeholder">No messages yet. Send a message to start the conversation.</p>}
      {messages.map(message => <div className={`chat-message ${message.sender === sender ? "mine" : ""}`} key={message.id}><span>{message.sender}</span><p>{message.text}</p><time>{message.time}</time></div>)}
    </div>
    <form className="chat-form" onSubmit={sendMessage}><input value={text} onChange={event => setText(event.target.value)} placeholder="Write a message..." aria-label="Message" /><button type="submit" aria-label="Send message" title="Send message"><Send size={15} /></button></form>
  </section>;
}