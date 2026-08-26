import { useEffect, useState } from "react";
import { Upload, UserRound, Mail, Phone, FileText, CheckCircle2, Save, Camera } from "lucide-react";
import SectionTitle from "../../components/SectionTitle";
import Toast from "../../components/Toast";
import { api } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function CandidateProfile() {
  const [file, setFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const { profile, avatarUrl, refreshAvatar, updateProfile } = useAuth();
  const name = profile?.full_name || "Candidate";
  const [form, setForm] = useState({ full_name: "", phone: "", location: "", headline: "", bio: "" });

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || "", phone: profile.phone || "", location: profile.location || "", headline: profile.headline || "", bio: profile.bio || "" });
  }, [profile]);

  function setField(field, value) { setForm(current => ({ ...current, [field]: value })); }
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
    const form = new FormData();
    form.append("file", nextFile);
    try {
      await api.upload("/uploads/avatar", form);
      await refreshAvatar();
      setAvatarPreview("");
      setToast("Profile photo uploaded successfully");
    } catch (error) {
      setToast(error.message);
    } finally {
      URL.revokeObjectURL(previewUrl);
    }
    setTimeout(() => setToast(""), 2200);
  }

  async function uploadResume(nextFile) {
    if (!nextFile) return;
    setFile(nextFile);
    const form = new FormData();
    form.append("file", nextFile);
    try {
      await api.upload("/uploads/resume", form);
      setToast("Resume uploaded successfully");
    } catch (error) {
      setToast(error.message);
    }
    setTimeout(() => setToast(""), 2200);
  }
  return <div>
    <Toast message={toast} onClose={() => setToast("")} />
    <SectionTitle eyebrow="PROFILE" title="Profile & Resume" description="Keep your hiring profile complete and up to date." />
    <div className="two-col">
      <section className="card">
        <div className="card-head"><div><h3>Personal information</h3><p>This information is shared with interviewers.</p></div><UserRound size={20} /></div>
        <div className="profile-photo-row">
          <label className="profile-photo-picker" title="Choose profile photo">
            <div className="profile-photo">
              {avatarPreview || avatarUrl ? <img src={avatarPreview || avatarUrl} alt={`${name} profile`} /> : name.slice(0, 2).toUpperCase()}
              <span><Camera size={12} /></span>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => uploadAvatar(e.target.files?.[0])} />
          </label>
          <div><b>Profile photo</b><p>Click the photo to change it.</p><small>JPG, PNG or WEBP · Max 5 MB</small></div>
        </div>
        <form className="form-grid" onSubmit={save}>
          <label>Full name<input value={form.full_name} onChange={e => setField("full_name", e.target.value)} required /></label>
          <label>Email<input value={profile?.email || ""} type="email" readOnly /></label>
          <label>Phone<input value={form.phone} onChange={e => setField("phone", e.target.value)} /></label>
          <label>Location<input value={form.location} onChange={e => setField("location", e.target.value)} /></label>
          <label className="span-2">Headline<input value={form.headline} onChange={e => setField("headline", e.target.value)} /></label>
          <label className="span-2">About<textarea value={form.bio} onChange={e => setField("bio", e.target.value)} /></label>
          <button className="btn btn-primary" type="submit" disabled={saving}><Save size={16} /> {saving ? "Saving..." : "Save changes"}</button>
        </form>
      </section>

      <section className="card">
        <div className="card-head"><div><h3>Resume</h3><p>Upload a PDF for AI-assisted job matching.</p></div><FileText size={20} /></div>
        <label className="upload-box">
          <input type="file" accept=".pdf,.doc,.docx" onChange={e => uploadResume(e.target.files?.[0])} />
          <Upload size={26} />
          <b>{file ? file.name : "Drop your resume here"}</b>
          <span>PDF, DOC or DOCX · Max 10 MB</span>
        </label>
        <div className="resume-status"><CheckCircle2 size={17} /><div><b>Current resume</b><span>Basana_Gowda_Resume.pdf · Uploaded Aug 23</span></div></div>
        <div className="mini-note"><b>AI resume match</b><strong>92%</strong><p>Strong match for Frontend Developer roles.</p></div>
      </section>
    </div>
  </div>;
}
