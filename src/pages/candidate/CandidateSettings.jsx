import { Bell, Camera, LockKeyhole, Save, Shield, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import Toast from "../../components/Toast";
import { useAuth } from "../../context/AuthContext";

export default function CandidateSettings() {
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const { profile, updateProfile } = useAuth();
  const [form, setForm] = useState({ full_name: "", location: "" });
  useEffect(() => { if (profile) setForm({ full_name: profile.full_name || "", location: profile.location || "" }); }, [profile]);
  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    try { await updateProfile(form); setToast("Candidate settings saved"); }
    catch (error) { setToast(error.message); }
    finally { setSaving(false); window.setTimeout(() => setToast(""), 2000); }
  }
  return <div><Toast message={toast} onClose={() => setToast("")} /><SectionTitle eyebrow="SETTINGS" title="Candidate settings" description="Manage your profile, interview preferences and notifications." />
    <div className="two-col"><section className="card"><div className="card-head"><div><h3><UserRound size={18}/> Profile preferences</h3><p>Keep your candidate details ready for interviewers.</p></div></div><form className="form-grid" onSubmit={save}><label>Full name<input value={form.full_name} onChange={e => setForm(current => ({ ...current, full_name: e.target.value }))} required /></label><label>Preferred role<input value={profile?.headline || ""} readOnly /></label><label>Email address<input type="email" value={profile?.email || ""} readOnly /></label><label>Location<input value={form.location} onChange={e => setForm(current => ({ ...current, location: e.target.value }))} /></label><button className="btn btn-primary" type="submit" disabled={saving}><Save size={16}/> {saving ? "Saving..." : "Save profile"}</button></form></section>
      <section className="card"><div className="card-head"><div><h3><Shield size={18}/> Interview privacy</h3><p>Choose what is enabled during live sessions.</p></div></div>{[["Camera presence","Allow camera checks during interviews",true],["Microphone access","Allow audio transcription while answering",true],["Screen sharing","Share your screen when a session requires it",false]].map(([title,text,on]) => <div className="setting-row" key={title}><div><b>{title}</b><p>{text}</p></div><input type="checkbox" defaultChecked={on} /></div>)}</section></div>
    <section className="card settings-bottom"><div className="settings-section"><Bell size={18}/><div><h3>Email notifications</h3><p>Receive interview invitations, reminders and result updates.</p></div><input type="checkbox" defaultChecked /></div><div className="settings-section"><Camera size={18}/><div><h3>Interview reminders</h3><p>Get a reminder before upcoming interviews.</p></div><input type="checkbox" defaultChecked /></div><div className="settings-section"><LockKeyhole size={18}/><div><h3>Account security</h3><p>Manage your password and active sessions.</p></div><button className="btn btn-outline" onClick={save}>Manage</button></div><button className="btn btn-primary" onClick={save}><Save size={16}/> Save settings</button></section>
  </div>;
}
