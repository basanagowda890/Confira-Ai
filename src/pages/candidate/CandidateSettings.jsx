import {
  Bell,
  Camera,
  Code,
  Download,
  LockKeyhole,
  Mic,
  RefreshCw,
  Save,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  Volume2,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { useEffect, useState } from "react";
import SectionTitle from "../../components/SectionTitle";
import Toast from "../../components/Toast";
import Badge from "../../components/Badge";
import ThemeToggle from "../../components/ThemeToggle";
import { useAuth } from "../../context/AuthContext";

const DEFAULT_SETTINGS = {
  theme: "light", // 'light' | 'dark'
  compactMode: false,
  soundAlerts: true,
  autoJoinCamera: true,
  autoJoinMicMuted: false,
  videoQuality: "720p",
  editorFontSize: "14px",
  editorTheme: "vs-dark",
  editorTabSize: "2",
  autoSaveEditorDrafts: true,
  emailNotifications: true,
  interviewReminders: true,
  jobMatchAlerts: true,
  proctoringCamera: true,
  proctoringMic: true,
  proctoringScreen: true,
};

export default function CandidateSettings() {
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const { profile } = useAuth();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("confira_candidate_settings");
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch {}
  }, []);

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function playTestChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      setToast("Played test notification chime.");
    } catch {
      setToast("AudioContext not supported on this browser.");
    }
  }

  function saveSettings(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      localStorage.setItem("confira_candidate_settings", JSON.stringify(settings));
      setToast("Website and workspace settings saved successfully!");
    } catch {
      setToast("Failed to save settings to browser storage.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 2800);
    }
  }

  function exportData() {
    try {
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        profile: {
          id: profile?.id,
          email: profile?.email,
          full_name: profile?.full_name,
          headline: profile?.headline,
          skills: profile?.skills,
        },
        preferences: settings,
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `confira_candidate_data_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast("Candidate data export downloaded.");
    } catch {
      setToast("Failed to export data.");
    }
  }

  function clearLocalCache() {
    try {
      localStorage.removeItem("confira_editor_drafts");
      sessionStorage.clear();
      setToast("Temporary editor snapshots and web cache cleared.");
    } catch {
      setToast("Failed to clear local cache.");
    }
  }

  return (
    <div>
      <Toast message={toast} onClose={() => setToast("")} />
      <SectionTitle
        eyebrow="SETTINGS"
        title="Candidate Website Settings"
        description="Configure your workspace experience, live interview room defaults, code editor, notifications, and privacy."
        action={
          <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
            <Save size={15} /> {saving ? "Saving..." : "Save all settings"}
          </button>
        }
      />

      {/* Theme & Display Mode */}
      <section className="card" style={{ marginBottom: "16px" }}>
        <div className="card-head">
          <div>
            <h3><Sun size={18} /> Website Appearance & Theme</h3>
            <p>Select your interface style: Light or Obsidian Dark.</p>
          </div>
          <Badge tone="info">Theme</Badge>
        </div>
        <ThemeToggle variant="cards" />
      </section>

      <div className="two-col">
        {/* Live Interview Defaults */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><Camera size={18} /> Live Interview & Media Defaults</h3>
              <p>Set how your camera, microphone, and streams initialize during interviews.</p>
            </div>
            <Badge tone="info">Live Room</Badge>
          </div>

          <div className="setting-row">
            <div>
              <b>Auto-enable Camera on Join</b>
              <p>Automatically turn on your video camera when entering an interview room.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoJoinCamera}
              onChange={e => update("autoJoinCamera", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Join with Microphone Muted</b>
              <p>Mute your microphone by default until you are ready to speak.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoJoinMicMuted}
              onChange={e => update("autoJoinMicMuted", e.target.checked)}
            />
          </div>

          <div style={{ marginTop: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", display: "block", marginBottom: "6px" }}>
              Preferred Video Stream Quality
            </label>
            <select
              value={settings.videoQuality}
              onChange={e => update("videoQuality", e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid var(--line)",
                background: "#fff",
                fontSize: "12px"
              }}
            >
              <option value="720p">HD (720p 30fps) - Recommended</option>
              <option value="1080p">Full HD (1080p 30fps) - High Bandwidth</option>
              <option value="480p">Standard (480p) - Low Bandwidth Friendly</option>
              <option value="auto">Adaptive Auto-Select</option>
            </select>
          </div>
        </section>

        {/* Code Editor & Technical Workspace */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><Code size={18} /> Code Editor & Coding Preferences</h3>
              <p>Customize the technical coding environment for live assessments.</p>
            </div>
            <Badge tone="success">IDE Settings</Badge>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <label style={{ fontSize: "12px", fontWeight: 700, display: "grid", gap: "6px" }}>
              Editor Font Size
              <select
                value={settings.editorFontSize}
                onChange={e => update("editorFontSize", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", fontSize: "12px" }}
              >
                <option value="12px">12px (Compact)</option>
                <option value="14px">14px (Standard)</option>
                <option value="16px">16px (Large)</option>
                <option value="18px">18px (Extra Large)</option>
              </select>
            </label>

            <label style={{ fontSize: "12px", fontWeight: 700, display: "grid", gap: "6px" }}>
              Editor Color Theme
              <select
                value={settings.editorTheme}
                onChange={e => update("editorTheme", e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--line)", background: "#fff", fontSize: "12px" }}
              >
                <option value="vs-dark">Dark (Default)</option>
                <option value="monokai">Monokai Pro</option>
                <option value="github-light">GitHub Light</option>
                <option value="dracula">Dracula</option>
              </select>
            </label>
          </div>

          <div className="setting-row">
            <div>
              <b>Auto-save Local Code Drafts</b>
              <p>Periodically back up your answers and code solutions to local browser cache.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.autoSaveEditorDrafts}
              onChange={e => update("autoSaveEditorDrafts", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Tab Indentation Width</b>
              <p>Number of spaces inserted when pressing Tab key in the editor.</p>
            </div>
            <select
              value={settings.editorTabSize}
              onChange={e => update("editorTabSize", e.target.value)}
              style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "11px" }}
            >
              <option value="2">2 spaces</option>
              <option value="4">4 spaces</option>
            </select>
          </div>
        </section>
      </div>

      <div className="two-col">
        {/* Notification & Audio Effects */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><Bell size={18} /> Notifications & Sound Alerts</h3>
              <p>Manage in-app auditory feedback, reminders, and alerts.</p>
            </div>
            <button className="btn btn-outline" style={{ padding: "5px 9px", fontSize: "11px" }} onClick={playTestChime}>
              <Volume2 size={13} /> Test Sound
            </button>
          </div>

          <div className="setting-row">
            <div>
              <b>In-app Notification Sound</b>
              <p>Play a pleasant sound when you receive messages or interviewer updates.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.soundAlerts}
              onChange={e => update("soundAlerts", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>15-Minute Interview Reminder</b>
              <p>Receive an alert reminder 15 minutes before your scheduled live sessions.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.interviewReminders}
              onChange={e => update("interviewReminders", e.target.checked)}
            />
          </div>

          <div className="setting-row">
            <div>
              <b>Job Matching Alerts</b>
              <p>Receive recommendations when open positions match your skill set.</p>
            </div>
            <input
              type="checkbox"
              checked={settings.jobMatchAlerts}
              onChange={e => update("jobMatchAlerts", e.target.checked)}
            />
          </div>
        </section>

        {/* Data & Website Management */}
        <section className="card">
          <div className="card-head">
            <div>
              <h3><Sliders size={18} /> Data & Website Cache Management</h3>
              <p>Export your data, reset temporary state, and manage account details.</p>
            </div>
            <Badge tone="neutral">Storage</Badge>
          </div>

          <div style={{ display: "grid", gap: "10px", marginTop: "6px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#FAF5F2", borderRadius: "10px" }}>
              <div>
                <b style={{ fontSize: "12px", display: "block" }}>Export My Platform Data</b>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Download your interview history, practice results, and profile summary in JSON.</span>
              </div>
              <button className="btn btn-outline" onClick={exportData} style={{ padding: "7px 11px", fontSize: "11px" }}>
                <Download size={14} /> Export
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#FAF5F2", borderRadius: "10px" }}>
              <div>
                <b style={{ fontSize: "12px", display: "block" }}>Clear Local Web Cache</b>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Purge stored temporary editor snapshots and reset workspace local storage.</span>
              </div>
              <button className="btn btn-outline" onClick={clearLocalCache} style={{ padding: "7px 11px", fontSize: "11px", color: "var(--danger)" }}>
                <Trash2 size={14} /> Clear Cache
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#FAF5F2", borderRadius: "10px" }}>
              <div>
                <b style={{ fontSize: "12px", display: "block" }}>Account Authentication Status</b>
                <span style={{ fontSize: "11px", color: "var(--muted)" }}>Authenticated as: <strong>{profile?.email || "Candidate"}</strong></span>
              </div>
              <Badge tone="success">Active Session</Badge>
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
