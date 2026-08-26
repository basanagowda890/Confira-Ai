import { useEffect, useState } from "react";
import { Download, Search, SlidersHorizontal, UserRound, ArrowRight, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";

export default function Candidates() {
  const [query,setQuery]=useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState({ job_id: "", date: "", time: "", type: "technical", duration_minutes: 60 });
  useEffect(() => {
    const load = () => Promise.all([api.get("/profiles/candidates"), api.get("/jobs")]).then(([candidateResult, jobResult]) => { setCandidates(candidateResult.data || []); setJobs((jobResult.data || []).filter(job => job.status !== "closed")); }).catch(error => setToast(error.message));
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);
  const filtered=candidates.filter(c=>`${c.full_name} ${c.headline || ""} ${c.location || ""}`.toLowerCase().includes(query.toLowerCase()));
  function openSchedule(candidate) { setSelected(candidate); setForm(current => ({ ...current, job_id: jobs[0]?.id || "" })); setScheduleOpen(true); }
  async function schedule(e) {
    e.preventDefault();
    try { await api.post("/interviews", { ...form, candidate_id: selected.id, title: `${selected.headline || "Candidate"} Interview`, scheduled_at: `${form.date}T${form.time}:00` }); setScheduleOpen(false); setSelected(null); setToast("Interview scheduled successfully"); }
    catch (error) { setToast(error.message); }
    setTimeout(() => setToast(""), 2200);
  }
  return <div><SectionTitle eyebrow="CANDIDATES" title="Candidate management" description="Review profiles, AI scores and integrity signals in one place." action={<button className="btn btn-outline" onClick={() => window.print()}><Download size={16}/> Export</button>} />
    <div className="search-row"><div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search candidates..." /></div><button className={`filter ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(value => !value)}><SlidersHorizontal size={15}/> Filters</button><Link className="btn btn-primary" to="/interviewer/comparison">Compare</Link></div>
    {filtersOpen && <p className="form-notice" role="status">Showing all candidates. Add a search term to narrow this list.</p>}
    <Toast message={toast} onClose={() => setToast("")} /><section className="card"><div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Headline</th><th>Location</th><th>Skills</th><th>Profile</th><th /></tr></thead><tbody>{filtered.map(candidate=><tr key={candidate.id}><td><div className="person-cell"><span className="avatar">{candidate.avatar_url ? <img src={candidate.avatar_url} alt="" /> : (candidate.full_name || "C").slice(0, 2).toUpperCase()}</span><div><b>{candidate.full_name || "Unnamed candidate"}</b><small>{candidate.email}</small></div></div></td><td>{candidate.headline || "Candidate"}</td><td>{candidate.location || "Not provided"}</td><td><div className="skill-row">{(candidate.skills || []).slice(0, 3).map(skill=><span key={skill}>{skill}</span>)}</div></td><td><button className="btn btn-outline" onClick={() => setSelected(candidate)}>View profile <ArrowRight size={15}/></button></td><td><button className="btn btn-primary" onClick={() => openSchedule(candidate)} disabled={!jobs.length}><CalendarDays size={15}/> Take interview</button></td></tr>)}</tbody></table></div>{!filtered.length && <p className="empty-state">No registered candidates found.</p>}</section>
    <Modal open={Boolean(selected) && !scheduleOpen} title={selected?.full_name || "Candidate profile"} onClose={() => setSelected(null)}>{selected && <div className="candidate-profile-modal"><div className="candidate-profile-avatar">{selected.avatar_url ? <img src={selected.avatar_url} alt={`${selected.full_name} profile`} /> : (selected.full_name || "C").slice(0, 2).toUpperCase()}</div><p>{selected.headline || "Candidate"} · {selected.location || "Location not provided"}</p><p>{selected.bio || "This candidate has not added an introduction yet."}</p><div className="skill-row">{(selected.skills || []).map(skill=><span key={skill}>{skill}</span>)}</div><button className="btn btn-primary" onClick={() => openSchedule(selected)} disabled={!jobs.length}><CalendarDays size={15}/> Take interview</button>{!jobs.length && <small>Create a job position before scheduling an interview.</small>}</div>}</Modal>
    <Modal open={scheduleOpen} title={`Schedule interview with ${selected?.full_name || "candidate"}`} onClose={() => setScheduleOpen(false)}><form className="form-grid" onSubmit={schedule}><label>Position<select value={form.job_id} onChange={e => setForm({...form, job_id: e.target.value})} required>{jobs.map(job=><option value={job.id} key={job.id}>{job.title}</option>)}</select></label><label>Round<select value={form.type} onChange={e => setForm({...form, type: e.target.value})}><option value="technical">Technical</option><option value="hr">HR</option><option value="technical_hr">Technical + HR</option></select></label><label>Date<input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required /></label><label>Time<input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} required /></label><label>Duration<select value={form.duration_minutes} onChange={e => setForm({...form, duration_minutes: Number(e.target.value)})}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label><button className="btn btn-primary" type="submit"><CalendarDays size={15}/> Schedule interview</button></form></Modal>
  </div>;
}