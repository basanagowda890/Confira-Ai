import { useEffect, useState } from "react";
import { BriefcaseBusiness, Plus, Search, MoreHorizontal, Users, MapPin, Edit, Archive, Trash2, CheckCircle2, Globe, Clock } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Badge from "../../components/Badge";
import Modal from "../../components/Modal";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
import { subscribeToTable } from "../../lib/realtime";

export default function Jobs() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [filter, setFilter] = useState("All positions");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);

  const initialForm = {
    title: "",
    department: "Engineering",
    location: "Remote",
    employment_type: "full_time",
    description: "",
    status: "published",
  };

  const [form, setForm] = useState(initialForm);

  const loadJobs = () => {
    Promise.all([
      api.get("/jobs"),
      api.get("/interviewer/applications"),
    ])
      .then(([jobRes, appRes]) => {
        setJobs(jobRes.data || []);
        setApplications(appRes.data || []);
      })
      .catch(error => setToast(error.message));
  };

  useEffect(() => {
    loadJobs();
    const unsub = subscribeToTable("jobs", null, loadJobs);
    return () => unsub();
  }, []);

  function openCreate() {
    setForm(initialForm);
    setCreateOpen(true);
  }

  function openEdit(job) {
    setEditingJob(job);
    setForm({
      title: job.title || "",
      department: job.department || "",
      location: job.location || "",
      employment_type: job.employment_type || "full_time",
      description: job.description || "",
      status: job.status || "draft",
    });
    setMenu(null);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await api.post("/jobs", form);
      setCreateOpen(false);
      setForm(initialForm);
      setToast("Position created successfully.");
      await loadJobs();
    } catch (error) {
      setToast(error.message || "Failed to create position.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editingJob || !form.title.trim()) return;
    setSaving(true);
    try {
      await api.put(`/jobs/${editingJob.id}`, form);
      setEditingJob(null);
      setToast("Position updated successfully.");
      await loadJobs();
    } catch (error) {
      setToast(error.message || "Failed to update position.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2500);
    }
  }

  async function toggleStatus(job) {
    const action = job.status === "published" ? "archive" : "publish";
    try {
      await api.post(`/jobs/${job.id}/${action}`);
      setToast(`Position ${action === "archive" ? "archived" : "published"} successfully.`);
      setMenu(null);
      await loadJobs();
    } catch (error) {
      setToast(error.message || "Failed to update position status.");
    }
    setTimeout(() => setToast(""), 2500);
  }

  async function handleDelete(job) {
    if (!window.confirm(`Are you sure you want to permanently delete the position "${job.title}"? This cannot be undone.`)) {
      return;
    }
    setMenu(null);
    try {
      await api.delete(`/jobs/${job.id}`);
      setJobs(prev => prev.filter(j => j.id !== job.id));
      setToast("Position deleted successfully.");
      await loadJobs();
    } catch (error) {
      setToast(error.message || "Failed to delete position.");
      await loadJobs();
    }
    setTimeout(() => setToast(""), 2500);
  }

  const appCountFor = jobId => applications.filter(a => a.job_id === jobId).length;

  const visibleJobs = jobs.filter(job => {
    const matchesFilter =
      filter === "All positions" ||
      (filter === "Open" ? job.status === "published" : filter === "Draft" ? job.status === "draft" : job.status === "closed");
    const matchesQuery = `${job.title} ${job.department || ""} ${job.location || ""}`
      .toLowerCase()
      .includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="JOBS & POSITIONS"
        title="Manage positions"
        description="Create roles, manage interview pipelines, and track candidate applications."
        action={
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} /> Create position
          </button>
        }
      />

      <div className="search-row">
        <div className="search-box">
          <Search size={17} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search positions by title, department or location..."
          />
        </div>
        {["All positions", "Open", "Draft", "Closed"].map(item => (
          <button
            key={item}
            className={`filter ${filter === item ? "active" : ""}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="cards-2">
        {visibleJobs.map(job => {
          const appCount = appCountFor(job.id);
          return (
            <div className="card job-card" key={job.id} style={{ position: "relative" }}>
              <div className="job-icon">
                <BriefcaseBusiness size={21} />
              </div>
              <div className="job-main" style={{ flex: 1 }}>
                <div className="card-head">
                  <div>
                    <h3>{job.title}</h3>
                    <p>{job.department || "General"} · {job.employment_type?.replace("_", " ") || "Full time"}</p>
                  </div>
                  <Badge tone={job.status === "published" ? "success" : job.status === "closed" ? "danger" : "neutral"}>
                    {job.status === "published" ? "Open" : job.status === "closed" ? "Archived" : "Draft"}
                  </Badge>
                </div>
                <p style={{ margin: "8px 0" }}>{job.description || "No description provided."}</p>
                <div className="meta-row">
                  <span><MapPin size={14} /> {job.location || "Remote"}</span>
                  <span><Users size={14} /> {appCount} {appCount === 1 ? "Application" : "Applications"}</span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                <button
                  className="icon-btn"
                  aria-label={`Open actions for ${job.title}`}
                  title="More actions"
                  onClick={() => setMenu(menu === job.id ? null : job.id)}
                >
                  <MoreHorizontal size={18} />
                </button>

                {menu === job.id && (
                  <div
                    style={{
                      position: "absolute",
                      top: "48px",
                      right: "16px",
                      background: "#1e2238",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "8px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                      zIndex: 10,
                      display: "flex",
                      flexDirection: "column",
                      minWidth: "160px",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(job)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: "13px",
                        textAlign: "left",
                      }}
                    >
                      <Edit size={14} /> Edit Position
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleStatus(job)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: "13px",
                        textAlign: "left",
                      }}
                    >
                      <Archive size={14} /> {job.status === "published" ? "Archive (Close)" : "Publish (Open)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(job)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        fontSize: "13px",
                        textAlign: "left",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <Trash2 size={14} /> Delete Position
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!visibleJobs.length && (
        <p className="empty-state">No positions found matching your filter.</p>
      )}

      {/* Create Position Modal */}
      <Modal open={createOpen} title="Create a new position" onClose={() => setCreateOpen(false)}>
        <form className="form-grid" onSubmit={handleCreate}>
          <label>
            Job title
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Senior Frontend Developer"
              required
            />
          </label>
          <label>
            Department
            <input
              value={form.department}
              onChange={e => setForm({ ...form, department: e.target.value })}
              placeholder="Engineering"
            />
          </label>
          <label>
            Location
            <input
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="Bengaluru / Remote"
            />
          </label>
          <label>
            Employment type
            <select
              value={form.employment_type}
              onChange={e => setForm({ ...form, employment_type: e.target.value })}
            >
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>
          <label>
            Initial status
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="published">Open (Published)</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className="span-2">
            Job description
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Describe responsibilities, required skills, and interview requirements."
              rows={4}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create position"}
          </button>
        </form>
      </Modal>

      {/* Edit Position Modal */}
      <Modal open={Boolean(editingJob)} title={`Edit position: ${editingJob?.title}`} onClose={() => setEditingJob(null)}>
        <form className="form-grid" onSubmit={handleUpdate}>
          <label>
            Job title
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
            />
          </label>
          <label>
            Department
            <input
              value={form.department}
              onChange={e => setForm({ ...form, department: e.target.value })}
            />
          </label>
          <label>
            Location
            <input
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
            />
          </label>
          <label>
            Employment type
            <select
              value={form.employment_type}
              onChange={e => setForm({ ...form, employment_type: e.target.value })}
            >
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="published">Open (Published)</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed (Archived)</option>
            </select>
          </label>
          <label className="span-2">
            Job description
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={4}
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Updating..." : "Save changes"}
          </button>
        </form>
      </Modal>
    </div>
  );
}