import {
  Bell,
  Bot,
  BrainCircuit,
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  PlaySquare,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  Volume2,
  Zap,
  Building2,
  Briefcase
} from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import Toast from "../../components/Toast";
import Badge from "../../components/Badge";
import ThemeToggle from "../../components/ThemeToggle";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const DEFAULT_INTERVIEWER_SETTINGS = {
  defaultDuration: "60",
  aiEvaluationStrictness: "detailed", // 'standard' | 'detailed' | 'strict'
  autoGenerateQuestions: true,
  autoGenerateScorecard: true,
  candidateJoinChime: true,
  alertSensitivity: "balanced", // 'high' | 'balanced' | 'permissive'
  liveTranscription: true,
  liveSentimentIndicators: true,
  autoScreenApplications: true,
  notifyOnApplication: true,
  notifyOnCandidateMessage: true,
  auditLogging: true,
};

export default function Settings() {
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [settings, setSettings] = useState(DEFAULT_INTERVIEWER_SETTINGS);
  
  const { profile, avatarUrl, refreshAvatar, refreshProfile, setDirectAvatar, updateProfile } = useAuth();

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    company: "",
    headline: "",
    phone: "",
    location: "",
    bio: "",
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || "",
        company: profile.company || "",
        headline: profile.headline || "",
        phone: profile.phone || "",
        location: profile.location || "",
        bio: profile.bio || "",
      });
    }
  }, [profile]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("confira_interviewer_settings");
      if (saved) {
        setSettings({ ...DEFAULT_INTERVIEWER_SETTINGS, ...JSON.parse(saved) });
      }
    } catch {}
  }, []);

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function handleProfileChange(field, value) {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  }

  // Upload Interviewer Avatar Photo
  async function uploadAvatar(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setToast("Image size must be less than 5 MB.");
      return;
    }

    setAvatarLoading(true);
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.upload("/uploads/avatar", formData);
      if (res?.url) {
        setDirectAvatar(res.url);
      }
      await refreshAvatar();
      setToast("Profile photo updated and saved everywhere!");
    } catch (err) {
      setToast(err.message || "Failed to upload profile photo.");
    } finally {
      setAvatarPreview("");
      setAvatarLoading(false);
      URL.revokeObjectURL(preview);
      setTimeout(() => setToast(""), 3000);
    }
  }

  // Delete Avatar
  async function removeAvatar() {
    try {
      await api.delete("/uploads/avatar");
      setDirectAvatar("");
      setAvatarPreview("");
      await refreshAvatar();
      setToast("Profile photo removed.");
    } catch (err) {
      setToast(err.message || "Failed to remove photo.");
    }
  }

  // Save Interviewer Profile
  async function saveInterviewerProfile(e) {
    e?.preventDefault();
    setSavingProfile(true);
    try {
      await api.put("/profiles/me", profileForm);
      if (updateProfile) {
        await updateProfile(profileForm);
      }
      if (refreshProfile) {
        await refreshProfile();
      }
      setToast("Interviewer profile updated successfully!");
    } catch (err) {
      setToast(err.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
      setTimeout(() => setToast(""), 3000);
    }
  }

  function playTestChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12); // G5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      setToast("Played candidate arrival chime.");
    } catch {
      setToast("AudioContext not supported.");
    }
  }

  function saveSettings(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      localStorage.setItem("confira_interviewer_settings", JSON.stringify(settings));
      setToast("Interviewer workspace and AI preferences saved successfully!");
    } catch {
      setToast("Failed to save settings to browser storage.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2800);
    }
  }

  function exportCompanyData() {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        company: profile?.company || profileForm.company || "Confira AI Workspace",
        interviewer: {
          id: profile?.id,
          email: profile?.email,
          full_name: profileForm.full_name || profile?.full_name,
          headline: profileForm.headline || profile?.headline,
          role: profile?.role,
        },
        workspaceSettings: settings,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `confira_workspace_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("Workspace configuration export downloaded.");
    } catch {
      setToast("Failed to export workspace data.");
    }
  }

  function clearWorkspaceCache() {
    try {
      sessionStorage.clear();
      setToast("Temporary workspace cache and staging data cleared.");
    } catch {
      setToast("Failed to clear workspace cache.");
    }
  }

  const currentPhoto = avatarPreview || avatarUrl || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80";

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="SETTINGS & PROFILE"
        title="Interviewer Profile & Workspace Settings"
        description="Update your interviewer personal details, company identity, automated AI evaluation, live room monitoring policies, and theme."
        action={
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            <Save size={15} /> {saving ? "Saving..." : "Save all preferences"}
          </button>
        }
      />

      {/* ── 1. Interviewer Profile Management ─────────────────────────────────── */}
      <section className="card" style={{ marginBottom: "20px" }}>
        <div className="card-head">
          <div>
            <h3><UserRound size={18} /> Interviewer & Company Profile</h3>
            <p>Your interviewer profile information is visible to candidates during interviews and in session invites.</p>
          </div>
          <Badge tone="success">Active Profile</Badge>
        </div>

        <form onSubmit={saveInterviewerProfile}>
          <div className="profile-photo-row">
            <label className="profile-photo-picker" title="Click to upload interviewer photo">
              <div className="profile-photo">
                <img
                  src={currentPhoto}
                  alt={profileForm.full_name || "Interviewer profile"}
                />
              </div>
              <span className="profile-photo-badge">
                <Camera size={11} />
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={e => uploadAvatar(e.target.files?.[0])}
                disabled={avatarLoading}
              />
            </label>

            <div style={{ flex: 1 }}>
              <b style={{ fontSize: "14px", display: "block" }}>Profile Photo</b>
              <p style={{ fontSize: "12px", color: "var(--muted)", margin: "2px 0 6px" }}>
                Click the photo badge to upload a new professional picture (JPG, PNG or WEBP · Max 5 MB).
              </p>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  style={{ background: "none", border: "none", color: "var(--danger)", fontSize: "11px", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "600" }}
                >
                  <Trash2 size={12} /> Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="form-grid">
            <label>
              Full Name
              <input
                type="text"
                value={profileForm.full_name}
                onChange={e => handleProfileChange("full_name", e.target.value)}
                placeholder="e.g. Alex Johnson"
                required
              />
            </label>

            <label>
              Company / Organization
              <input
                type="text"
                value={profileForm.company}
                onChange={e => handleProfileChange("company", e.target.value)}
                placeholder="e.g. Confira AI, TechCorp Inc."
              />
            </label>

            <label>
              Professional Role / Title
              <input
                type="text"
                value={profileForm.headline}
                onChange={e => handleProfileChange("headline", e.target.value)}
                placeholder="e.g. Senior Technical Recruiter / Engineering Lead"
              />
            </label>

            <label>
              Email Address
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                style={{ background: "var(--cream)", cursor: "not-allowed", opacity: 0.8 }}
                title="Email is tied to your login account"
              />
            </label>

            <label>
              Contact Phone
              <input
                type="tel"
                value={profileForm.phone}
                onChange={e => handleProfileChange("phone", e.target.value)}
                placeholder="+1 (555) 019-2834"
              />
            </label>

            <label>
              Location / Timezone
              <input
                type="text"
                value={profileForm.location}
                onChange={e => handleProfileChange("location", e.target.value)}
                placeholder="e.g. San Francisco, CA (PST)"
              />
            </label>

            <label className="span-2">
              Interviewer Bio / Company Overview
              <textarea
                rows={3}
                value={profileForm.bio}
                onChange={e => handleProfileChange("bio", e.target.value)}
                placeholder="Share a brief overview of your team, interview standards, or welcoming message for candidates..."
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
            <button className="btn btn-primary" type="submit" disabled={savingProfile}>
              <Save size={15} /> {savingProfile ? "Saving Profile..." : "Update Interviewer Profile"}
            </button>
          </div>
        </form>
      </section>

      {/* ── 2. Theme & Display Mode ─────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: "20px" }}>
        <div className="card-head">
          <div>
            <h3><Sun size={18} /> Website Appearance & Theme</h3>
            <p>Choose your workspace theme: Light or Obsidian Dark.</p>
          </div>
          <Badge tone="info">Theme</Badge>
        </div>
        <ThemeToggle variant="cards" />
      </section>

      {/* ── 3. AI & Monitoring Preferences ─────────────────────────────────── */}
      <div className="two-col">
        {/* AI & Interview Automation */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><BrainCircuit size={18} /> AI Evaluation & Interview Automation</h3>
              <p>Configure automated question generation and AI analysis criteria.</p>
            </div>
            <Badge tone="success">AI Engine</Badge>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, display: "grid", gap: "6px" }}>
              Default Interview Duration
              <select
                value={settings.defaultDuration}
                onChange={e => update("defaultDuration", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", fontSize: "12px" }}
              >
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes (Standard)</option>
                <option value="90">90 Minutes (Deep Dive)</option>
              </select>
            </label>

            <label style={{ fontSize: "12px", fontWeight: 700, display: "grid", gap: "6px" }}>
              AI Scoring Criteria Strictness
              <select
                value={settings.aiEvaluationStrictness}
                onChange={e => update("aiEvaluationStrictness", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", fontSize: "12px" }}
              >
                <option value="standard">Standard Balanced</option>
                <option value="detailed">Detailed Multi-Dimensional</option>
                <option value="strict">Strict Technical Focus</option>
              </select>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <b>Auto-generate Starter Questions</b>
              <p>Automatically create tailored technical questions when scheduling a new interview.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoGenerateQuestions}
              onChange={e => update("autoGenerateQuestions", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Auto-generate Scorecard on Complete</b>
              <p>Run AI evaluation and synthesize performance summary immediately upon session wrap-up.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoGenerateScorecard}
              onChange={e => update("autoGenerateScorecard", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Auto-Screen Incoming Applications</b>
              <p>Generate match percentages and skill alignment scores when candidates apply.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoScreenApplications}
              onChange={e => update("autoScreenApplications", e.target.checked)}
            />
          </div>
        </section>

        {/* Live Room Monitoring & Proctoring Policy */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><Shield size={18} /> Live Room & Proctoring Policy</h3>
              <p>Set monitoring sensitivity and live feedback features for room sessions.</p>
            </div>
            <Badge tone="warning">Proctoring</Badge>
          </div>

          <div style={{ marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: "6px" }}>
              Tab-Switch & Gaze Alert Sensitivity
            </label>
            <select
              value={settings.alertSensitivity}
              onChange={e => update("alertSensitivity", e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "#fff",
                fontSize: "12px"
              }}
            >
              <option value="high">High (Flag brief unfocus and multiple tabs)</option>
              <option value="balanced">Balanced (Flag sustained tab switches & absence)</option>
              <option value="permissive">Permissive (Log events without popups)</option>
            </select>
          </div>

          <div className="setting-row">
            <div>
              <b>Play Candidate Arrival Chime</b>
              <p>Audible sound cue when the candidate joins the signaling room.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                className="btn btn-outline"
                style={{ padding: "4px 8px", fontSize: "10px" }}
                type="button"
                onClick={playTestChime}
              >
                <Volume2 size={12} /> Test
              </button>
              <input
                type="checkbox"
                checked={settings.candidateJoinChime}
                onChange={e => update("candidateJoinChime", e.target.checked)}
              />
            </div>
          </div>

          <div className="setting-row">
            <div>
              <b>Real-time Speech-to-Text Transcription</b>
              <p>Stream live audio captions and speech transcripts during the interview.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.liveTranscription}
              onChange={e => update("liveTranscription", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Integrity Audit Event Logging</b>
              <p>Store proctoring alerts and security timelines in candidate reports.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.auditLogging}
              onChange={e => update("auditLogging", e.target.checked)}
            />
          </div>
        </section>
      </div>

      {/* ── 4. Notifications & Data Export ───────────────────────────────────── */}
      <div className="two-col">
        {/* Notifications & Communications */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><Bell size={18} /> Alerts & Communication Preferences</h3>
              <p>Control what system activities send instant in-app and email updates.</p>
            </div>
            <Badge tone="info">Alerts</Badge>
          </div>

          <div className="setting-row">
            <div>
              <b>Notify on New Job Applications</b>
              <p>Receive alert when a candidate applies to any of your active job listings.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifyOnApplication}
              onChange={e => update("notifyOnApplication", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Notify on Candidate Messages</b>
              <p>Instant notification whenever a candidate sends a question or availability update.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifyOnCandidateMessage}
              onChange={e => update("notifyOnCandidateMessage", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Live AI Sentiment & Tone Indicators</b>
              <p>Show live sentiment and confidence metrics during interview monitoring.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.liveSentimentIndicators}
              onChange={e => update("liveSentimentIndicators", e.target.checked)}
            />
          </div>
        </section>

        {/* Data Export & Workspace Management */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><Sliders size={18} /> Workspace & Data Management</h3>
              <p>Export company reports, manage workspace security and cache.</p>
            </div>
            <Badge tone="neutral">Workspace</Badge>
          </div>

          <div style={{ display: "grid", gap: "10px", marginTop: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#FAF5F2", borderRadius: "10px" }}>
              <div>
                <b style={{ fontSize: "12px", display: "block" }}>Export Workspace Configuration</b>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Download hiring workspace settings and AI evaluation rules in JSON.</span>
              </div>
              <button className="btn btn-outline" onClick={exportCompanyData} style={{ padding: "7px 11px", fontSize: "11px" }}>
                <Download size={14} /> Export
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#FAF5F2", borderRadius: "10px" }}>
              <div>
                <b style={{ fontSize: "12px", display: "block" }}>Clear Workspace Session Cache</b>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Purge temporary question drafts and local monitoring state.</span>
              </div>
              <button className="btn btn-outline" onClick={clearWorkspaceCache} style={{ padding: "7px 11px", fontSize: "11px", color: "var(--danger)" }}>
                <Trash2 size={14} /> Clear Cache
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#FAF5F2", borderRadius: "10px" }}>
              <div>
                <b style={{ fontSize: "12px", display: "block" }}>Interviewer Role & Security</b>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Role: <strong>{profile?.role || "Interviewer"}</strong> ({profile?.email})</span>
              </div>
              <Badge tone="success">Verified</Badge>
            </div>
          </div>
        </section>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
          <Save size={15} /> {saving ? "Saving..." : "Save All Settings"}
        </button>
      </div>
    </div>
  );
}