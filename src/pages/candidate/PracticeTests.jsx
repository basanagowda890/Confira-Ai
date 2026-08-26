import { ArrowRight, Code2, Database, MessageCircle, Timer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";

const tests = [
  ["React Fundamentals", "20 questions · 25 min", Code2, "Intermediate"],
  ["JavaScript Core", "25 questions · 30 min", Code2, "Intermediate"],
  ["SQL & Databases", "20 questions · 20 min", Database, "Beginner"],
  ["Communication", "15 questions · 15 min", MessageCircle, "All levels"]
];

export default function PracticeTests() {
  const navigate = useNavigate();
  return <div><SectionTitle eyebrow="PRACTICE" title="Practice tests" description="Prepare for common interview rounds with timed assessments." /><div className="cards-2">{tests.map(([name, meta, Icon, level])=><div className="card test-card" key={name}><div className="feature-icon"><Icon size={20}/></div><div><h3>{name}</h3><p>{meta}</p><span className="muted"><Timer size={13}/> {level}</span></div><button className="btn btn-outline" onClick={() => navigate("/candidate/system-check")}>Start <ArrowRight size={15}/></button></div>)}</div></div>;
}