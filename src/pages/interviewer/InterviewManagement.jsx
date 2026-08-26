import { useEffect, useState } from "react";
import { CalendarDays, Plus, Clock3, Video, Users, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function InterviewManagement() {
  const [open,setOpen]=useState(false);
  const [menu,setMenu]=useState(null);
  const [calendarDate, setCalendarDate] = useState(new Date(2026, 7, 1));
  const [selectedDay, setSelectedDay] = useState(27);
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [form, setForm] = useState({ candidate_id: "", job_id: "", title: "Interview", type: "technical", scheduled_at: "", duration_minutes: 60 });
  const [notice, setNotice] = useState("");
  const load = () => Promise.all([api.get("/interviews"), api.get("/jobs"), api.get("/profiles/candidates")]).then(([interviews, jobResult, candidateResult]) => { setRows(interviews.data || []); setJobs(jobResult.data || []); setCandidates(candidateResult.data || []); }).catch(error => setNotice(error.message));
  useEffect(() => { load(); return subscribeToTable("interviews", null, load); }, []);
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const monthName = calendarDate.toLocaleString("en-US", { month: "long" });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const interviewsByDay = rows.reduce((result, row) => {
    const date = new Date(row.scheduled_at);
    if (!Number.isNaN(date.getTime())) { const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; result[key] = (result[key] || 0) + 1; }
    return result;
  }, {});
  const selectedInterviewCount = interviewsByDay[`${year}-${month}-${selectedDay}`] || 0;
  function changeMonth(offset) {
    setCalendarDate(new Date(year, month + offset, 1));
    setSelectedDay(1);
  }
  function openSchedule() { setForm(current => ({ ...current, candidate_id: candidates[0]?.id || "", job_id: jobs[0]?.id || "", title: jobs[0] ? `${jobs[0].title} Interview` : "Interview" })); setOpen(true); }
  async function schedule(event) { event.preventDefault(); try { await api.post("/interviews", form); setOpen(false); setNotice("Interview scheduled successfully"); await load(); } catch (error) { setNotice(error.message); } }
  return <div><SectionTitle eyebrow="INTERVIEWS" title="Interview management" description="Schedule sessions, assign interviewers and configure monitoring." action={<button className="btn btn-primary" onClick={openSchedule}><Plus size={16}/> Schedule interview</button>} />
    {notice && <p className="form-notice" role="status">{notice}</p>}
    <section className="card company-calendar">
      <div className="calendar-header"><div><h3>Interview calendar</h3><p>{monthName} {year} · Select a day to review scheduled sessions.</p></div><div className="calendar-nav"><button className="icon-btn" aria-label="Previous month" title="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft size={16}/></button><b>{monthName} {year}</b><button className="icon-btn" aria-label="Next month" title="Next month" onClick={() => changeMonth(1)}><ChevronRight size={16}/></button></div></div>
      <div className="calendar-weekdays">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-month-grid">{Array.from({length: firstWeekday}, (_, index) => <span className="calendar-blank" key={`blank-${index}`} />)}{Array.from({length: daysInMonth}, (_, index) => { const day = index + 1; const event = interviewsByDay[`${year}-${month}-${day}`]; return <button type="button" className={`calendar-date ${selectedDay === day ? "selected" : ""} ${event ? "has-event" : ""}`} onClick={() => setSelectedDay(day)} key={day}><b>{day}</b>{event && <small>{event} interview{event > 1 ? "s" : ""}</small>}</button>; })}</div>
      <p className="calendar-selection"><CalendarDays size={15}/> {selectedInterviewCount ? `${selectedInterviewCount} interview(s) on ${monthName} ${selectedDay}, ${year}` : `No interviews scheduled on ${monthName} ${selectedDay}, ${year}`}</p>
    </section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Position</th><th>Date & time</th><th>Round</th><th>Status</th><th /></tr></thead><tbody>{rows.map(row=>{const date=new Date(row.scheduled_at); return <tr key={row.id}><td><b>{row.profiles?.full_name || "Candidate"}</b><small>{row.profiles?.email}</small></td><td>{row.jobs?.title || row.title}</td><td><span className="meta-inline"><CalendarDays size={14}/>{date.toLocaleString()}</span></td><td>{row.type}</td><td><Badge tone={row.status === "live" ? "danger" : row.status === "completed" ? "success" : "info"}>{row.status}</Badge></td><td><button className="icon-btn" aria-label={`Open actions for ${row.title}`} title="More actions" onClick={() => setMenu(menu === row.id ? null : row.id)}><MoreHorizontal size={16}/></button>{menu === row.id && <span className="form-notice">Edit or cancel interview</span>}</td></tr>;})}</tbody></table></div>{!rows.length && <p className="empty-state">No interviews scheduled yet.</p>}</section>
    <Modal open={open} title="Schedule interview" onClose={()=>setOpen(false)}><form className="form-grid" onSubmit={schedule}><label>Candidate<select value={form.candidate_id} onChange={e=>setForm({...form,candidate_id:e.target.value})} required>{candidates.map(candidate=><option value={candidate.id} key={candidate.id}>{candidate.full_name || candidate.email}</option>)}</select></label><label>Position<select value={form.job_id} onChange={e=>{const job=jobs.find(item=>item.id===e.target.value);setForm({...form,job_id:e.target.value,title:`${job?.title || "Candidate"} Interview`})}} required>{jobs.map(job=><option value={job.id} key={job.id}>{job.title}</option>)}</select></label><label>Date and time<input type="datetime-local" value={form.scheduled_at} onChange={e=>setForm({...form,scheduled_at:e.target.value})} required /></label><label>Round<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}><option value="technical">Technical</option><option value="hr">HR</option><option value="technical_hr">Technical + HR</option></select></label><label>Duration<select value={form.duration_minutes} onChange={e=>setForm({...form,duration_minutes:Number(e.target.value)})}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option></select></label><button className="btn btn-primary" type="submit" disabled={!candidates.length || !jobs.length}>Schedule interview</button></form></Modal>
  </div>;
}