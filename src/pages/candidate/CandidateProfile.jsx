import { useEffect, useState } from "react";
import { Upload, UserRound, Mail, Phone, FileText, CheckCircle2, Save, Camera, Eye, Trash2, Plus, X } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function CandidateProfile() {
  const [file, setFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const { profile, avatarUrl, refreshAvatar, refreshProfile, setDirectAvatar, updateProfile } = useAuth();
  const name = profile?.full_name || "Candidate";
  const [form, setForm] = useState({ full_name: "", phone: "", location: "", headline: "", bio: "", skills: [] });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        location: profile.location || "",
        headline: profile.headline || "",
        bio: profile.bio || "",
        skills: Array.isArray(profile.skills) ? profile.skills : [],
      });
    }
  }, [profile]);

  function setField(field, value) {
    setForm(current => ({ ...current, [field]: value }));
  }

  function addSkill(e) {
    e.preventDefault();
    const trimmed = skillInput.trim();
    if (trimmed && !form.skills.includes(trimmed)) {
      setForm(current => ({ ...current, skills: [...current.skills, trimmed] }));
      setSkillInput("");
    }
  }

  function removeSkill(skillToRemove) {
    setForm(current => ({ ...current, skills: current.skills.filter(s => s !== skillToRemove) }));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(form);
      setToast("Profile saved successfully");
    } catch (error) {
      setToast(error.message);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2200);
    }
  }

  async function uploadAvatar(nextFile) {
    if (!nextFile) return;
    const previewUrl = URL.createObjectURL(nextFile);
    setAvatarPreview(previewUrl);
    const formData = new FormData();
    formData.append("file", nextFile);
    try {
      const res = await api.upload("/uploads/avatar", formData);
      if (res?.url) {
        setDirectAvatar(res.url);
      }
      await refreshAvatar();
      setToast("Profile photo uploaded and updated everywhere!");
    } catch (error) {
      setToast(error.message || "Failed to upload photo.");
    } finally {
      setAvatarPreview("");
      URL.revokeObjectURL(previewUrl);
    }
    setTimeout(() => setToast(""), 2500);
  }

  async function deleteAvatar() {
    try {
      await api.delete("/uploads/avatar");
      setDirectAvatar("");
      setAvatarPreview("");
      await refreshAvatar();
      setToast("Profile photo removed.");
    } catch (error) {
      setToast(error.message || "Failed to remove photo.");
    }
    setTimeout(() => setToast(""), 2500);
  }

  async function uploadResume(nextFile) {
    if (!nextFile) return;
    setFile(nextFile);
    setResumeLoading(true);
    const formData = new FormData();
    formData.append("file", nextFile);
    try {
      await api.upload("/uploads/resume", formData);
      await refreshProfile();
      setToast("Resume uploaded successfully");
    } catch (error) {
      setToast(error.message);
    } finally {
      setResumeLoading(false);
    }
    setTimeout(() => setToast(""), 2200);
  }

  async function viewResume() {
    try {
      const res = await api.get("/uploads/resume");
      if (res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      setToast(error.message || "Could not retrieve resume.");
      setTimeout(() => setToast(""), 2200);
    }
  }

  async function deleteResume() {
    if (!window.confirm("Are you sure you want to remove your resume?")) return;
    try {
      await api.delete("/uploads/resume");
      await refreshProfile();
      setFile(null);
      setToast("Resume removed.");
    } catch (error) {
      setToast(error.message);
    }
    setTimeout(() => setToast(""), 2200);
  }

  const resumeFilename = profile?.resume_path ? profile.resume_path.split("/").pop() : null;

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle eyebrow="PROFILE" title="Profile & Resume" description="Keep your hiring profile complete and up to date." />
      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <div>
              <h3>Personal information</h3>
              <p>This information is shared with interviewers.</p>
            </div>
            <UserRound size={20} />
          </div>
          <div className="profile-photo-row">
            <label className="profile-photo-picker" title="Choose profile photo">
              <div className="profile-photo" style={{ overflow: "hidden" }}>
                <img
                  src={avatarPreview || avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                  alt={`${name} profile`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                <span><Camera size={12} /></span>
              </div>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadAvatar(e.target.files?.[0])} />
            </label>
            <div>
              <b>Profile photo</b>
              <p>Click the photo to change it.</p>
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
                <small>JPG, PNG or WEBP · Max 5 MB</small>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={deleteAvatar}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      fontSize: "11px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: 0
                    }}
                  >
                    <Trash2 size={11} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
          <form className="form-grid" onSubmit={save}>
            <label>
              Full name
              <input value={form.full_name} onChange={e => setField("full_name", e.target.value)} required />
            </label>
            <label>
              Email
              <input value={profile?.email || ""} type="email" readOnly />
            </label>
            <label>
              Phone
              <input value={form.phone} onChange={e => setField("phone", e.target.value)} placeholder="+1 (555) 000-0000" />
            </label>
            <label>
              Location
              <input value={form.location} onChange={e => setField("location", e.target.value)} placeholder="City, Country" />
            </label>
            <label className="span-2">
              Headline
              <input value={form.headline} onChange={e => setField("headline", e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
            </label>
            <label className="span-2">
              About
              <textarea value={form.bio} onChange={e => setField("bio", e.target.value)} placeholder="Brief summary of your professional background and interests." />
            </label>

            <div className="span-2">
              <label>Skills & Technologies</label>
              <div style={{ display: "flex", gap: "8px", marginTop: "4px", marginBottom: "8px" }}>
                <input
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  placeholder="Add a skill (e.g. React, TypeScript, Python)"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addSkill(e); } }}
                />
                <button type="button" className="btn btn-outline" onClick={addSkill}>
                  <Plus size={16} /> Add
                </button>
              </div>
              <div className="skill-row" style={{ minHeight: "28px" }}>
                {form.skills.map(skill => (
                  <span key={skill} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {skill}
                    <button type="button" onClick={() => removeSkill(skill)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", color: "inherit" }}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                {!form.skills.length && <small className="muted">No skills added yet.</small>}
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={saving}>
              <Save size={16} /> {saving ? "Saving..." : "Save changes"}
            </button>
          </form>
        </section>

        <section className="card">
          <div className="card-head">
            <div>
              <h3>Resume</h3>
              <p>Upload your resume to share securely with interviewers.</p>
            </div>
            <FileText size={20} />
          </div>
          <label className="upload-box">
            <input type="file" accept=".pdf,.doc,.docx" onChange={e => uploadResume(e.target.files?.[0])} disabled={resumeLoading} />
            <Upload size={26} />
            <b>{resumeLoading ? "Uploading resume..." : file ? file.name : "Drop your resume here or click to browse"}</b>
            <span>PDF, DOC or DOCX · Max 10 MB</span>
          </label>

          {profile?.resume_path ? (
            <div className="resume-status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <CheckCircle2 size={18} />
                <div>
                  <b>Resume uploaded</b>
                  <span>{resumeFilename || "resume.pdf"} · Stored securely</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="btn btn-outline" onClick={viewResume} title="View resume via signed URL">
                  <Eye size={15} /> View
                </button>
                <button type="button" className="btn btn-danger" onClick={deleteResume} title="Delete resume">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ) : (
            <p className="empty-state">No resume uploaded yet. Upload a document to complete your profile.</p>
          )}
        </section>
      </div>
    </div>
  );
}

