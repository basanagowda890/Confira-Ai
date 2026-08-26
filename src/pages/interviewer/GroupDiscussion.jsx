import { MessageCircle, Mic2, Users, Video, Volume2 } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import ProgressBar from "../../components/ProgressBar";

const people=[["BG","Basana Gowda",86],["PS","Priya Sharma",79],["AP","Arjun Patel",91],["NR","Neha Rao",82]];

export default function GroupDiscussion() {
  return <div><SectionTitle eyebrow="GROUP DISCUSSION" title="Live group discussion" description="Monitor participation, communication and topic relevance across the group." action={<Badge tone="danger"><span className="live-dot"/> Live</Badge>} />
    <div className="gd-grid"><section className="card gd-video"><div className="gd-toolbar"><span><Video size={16}/> 4 participants</span><span><Volume2 size={16}/> Audio active</span><Badge tone="info">Topic: Remote work</Badge></div><div className="participant-grid">{people.map(([a,n,s])=><div className="participant" key={n}><div className="camera-person">{a}</div><span>{n}</span><small>{s}% participation</small></div>)}</div></section><aside className="card"><div className="card-head"><h3>Participation</h3><Users size={18}/></div>{people.map(([a,n,s])=><div className="gd-person" key={n}><span className="avatar">{a}</span><div><b>{n}</b><ProgressBar value={s}/></div><strong>{s}%</strong></div>)}<div className="card-divider"/><div className="gd-signal"><MessageCircle size={18}/><div><b>Speaking balance</b><p>No participant dominates the discussion.</p></div></div><div className="gd-signal"><Mic2 size={18}/><div><b>Communication</b><p>Clear speech and appropriate turn-taking.</p></div></div></aside></div>
  </div>;
}