import { useEffect, useState } from "react";
import { BriefcaseBusiness, MapPin, Send } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function CandidateJobs() {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [notice, setNotice] = useState("");
  const load = () => Promise.all([api.get("/jobs"), api.get("/candidate/applications")]).then(([jobResult, applicationResult]) => { setJobs(jobResult.data || []); setApplications(applicationResult.data || []); }).catch(error => setNotice(error.message));
  useEffect(() => { load(); return subscribeToTable("jobs", null, load); }, []);
  const applicationFor = jobId => applications.find(application => application.job_id === jobId);
  async function apply(job) {
    try { await api.post(`/jobs/${job.id}/apply`); setNotice("Application submitted successfully"); await load(); }
    catch (error) { setNotice(error.message); }
  }
  return <div><SectionTitle eyebrow="JOBS" title="Find your next opportunity" description="Browse published positions and track your applications from one shared workspace." />{notice && <p className="form-notice" role="status">{notice}</p>}<div className="cards-2">{jobs.map(job => { const application = applicationFor(job.id); return <section className="card job-card" key={job.id}><div className="job-icon"><BriefcaseBusiness size={21} /></div><div className="job-main"><div className="card-head"><div><h3>{job.title}</h3><p>{job.department || "Engineering"}</p></div><Badge tone="success">Open</Badge></div><p>{job.description || "Learn more about this opportunity and apply to join the interview process."}</p><div className="meta-row"><span><MapPin size={14} />{job.location || "Remote"}</span><span>{job.employment_type || "Full time"}</span></div>{application && <p className="form-notice">Application: {application.status}</p>}</div>{application ? <Badge tone="info">{application.status}</Badge> : <button className="btn btn-primary" onClick={() => apply(job)}><Send size={15} /> Apply</button>}</section>; })}</div>{!jobs.length && <p className="empty-state">No published jobs are available.</p>}<section className="card"><div className="card-head"><div><h3>My applications</h3><p>Status updates come from the interviewer workspace.</p></div></div>{applications.length ? <div className="table-wrap"><table><thead><tr><th>Position</th><th>Applied</th><th>Status</th></tr></thead><tbody>{applications.map(application => <tr key={application.id}><td>{application.jobs?.title || "Position"}</td><td>{new Date(application.created_at).toLocaleDateString()}</td><td><Badge tone="info">{application.status}</Badge></td></tr>)}</tbody></table></div> : <p className="empty-state">You have not applied to any positions yet.</p>}</section></div>;
}
