import { BookOpen, ExternalLink, FileText, PlayCircle } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";

export default function CandidateResources() {
  const resources = [
    ["Interview preparation checklist", "PDF guide", FileText],
    ["STAR answer framework", "Reading", BookOpen],
    ["Technical interview walkthrough", "Video", PlayCircle],
    ["Remote interview best practices", "Guide", BookOpen]
  ];
  return <div><SectionTitle eyebrow="RESOURCES" title="Interview resources" description="Guides to help you prepare with confidence." /><div className="cards-2">{resources.map(([title,meta,Icon])=><div className="card resource-card" key={title}><span className="feature-icon"><Icon size={20}/></span><div><h3>{title}</h3><p>{meta}</p></div><button className="icon-btn" aria-label={`Open ${title}`} title={`Open ${title}`} onClick={() => window.open("https://www.google.com/search?q=" + encodeURIComponent(title), "_blank", "noopener,noreferrer")}><ExternalLink size={17}/></button></div>)}</div></div>;
}