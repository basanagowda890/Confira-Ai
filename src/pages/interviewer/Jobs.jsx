import { useEffect, useState } from "react";
import { BriefcaseBusiness, Plus, Search, MoreHorizontal, Users, MapPin } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function Jobs() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("All positions");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ title: "", department: "", location: "", description: "", status: "draft" });
  const [notice, setNotice] = useState("");
  const loadJobs = () => api.get("/jobs").then(result => setJobs(result.data || [])).catch(error => setNotice(error.message));
  useEffect(() => { loadJobs(); return subscribeToTable("jobs", null, loadJobs); }, []);
  async function createJob() { try { await api.post("/jobs", form); setOpen(false); setForm({ title: "", department: "", location: "", description: "", status: "draft" }); await loadJobs(); } catch (error) { setNotice(error.message); } }
  const visibleJobs = jobs.filter(job => (filter === "All positions" || (filter === "Open" ? job.status === "published" : job.status === "draft")) && job.title.toLowerCase().includes(query.toLowerCase()));
  return <div><SectionTitle eyebrow="JOBS & POSITIONS" title="Manage positions" description="Create roles, define interview criteria and track the hiring pipeline." action={<button className="btn btn-primary" onClick={()=>setOpen(true)}><Plus size={16}/> Create position</button>} />
    <div className="search-row"><div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search positions..." /></div>{["All positions", "Open", "Draft"].map(item => <button key={item} className={`filter ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>{item}</button>)}</div>
    {notice && <p className="form-notice" role="status">{notice}</p>}<div className="cards-2">{visibleJobs.map(job=><div className="card job-card" key={job.id}><div className="job-icon"><BriefcaseBusiness size={21}/></div><div className="job-main"><div className="card-head"><div><h3>{job.title}</h3><p>{job.department || "Engineering"}</p></div><Badge tone={job.status === "published" ? "success" : "neutral"}>{job.status === "published" ? "Open" : job.status}</Badge></div><div className="meta-row"><span><MapPin size={14}/>{job.location || "Remote"}</span><span><Users size={14}/>Applications</span></div></div><button className="icon-btn" aria-label={`Open actions for ${job.title}`} title="More actions" onClick={() => setMenu(menu === job.id ? null : job.id)}><MoreHorizontal size={18}/></button>{menu === job.id && <span className="form-notice">Edit or archive position</span>}</div>)}</div>
    <Modal open={open} title="Create a new position" onClose={()=>setOpen(false)}><div className="form-grid"><label>Job title<input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Frontend Developer" required /></label><label>Department<input value={form.department} onChange={e => setForm({...form, department: e.target.value})} placeholder="Engineering" /></label><label>Location<input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Bengaluru / Remote" /></label><label>Status<select value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="draft">Draft</option><option value="published">Open</option></select></label><label className="span-2">Job description<textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe responsibilities, requirements and success criteria." /></label></div><button className="btn btn-primary" onClick={createJob}>Create position</button></Modal>
  </div>;
}