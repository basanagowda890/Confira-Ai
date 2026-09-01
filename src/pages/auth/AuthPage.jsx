import { useState } from "react";
import { ArrowRight, Building2, Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";

export default function AuthPage() {
  const [role, setRole] = useState("candidate");
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login, register } = useAuth();

  async function submit(e) {
    e.preventDefault();
    setNotice("");
    setLoading(true);
    try {
      const result = isRegistering
        ? await register({ email, password, fullName, role })
        : await login(email, password);

      if (!result) {
        throw new Error("Unable to complete authentication. Please try again.");
      }

      if (result.confirmationRequired) {
        setNotice("Account created. Please check your email to confirm your account, then log in.");
        setIsRegistering(false);
        return;
      }

      const userRole = result.profile?.role || result.role || role || "candidate";
      navigate(userRole === "candidate" ? "/candidate/dashboard" : "/interviewer/dashboard", { replace: true });
    } catch (error) {
      const message = error?.message || "We could not sign you in. Please try again.";
      if (
        message.toLowerCase().includes("invalid login") ||
        message.toLowerCase().includes("invalid_credentials") ||
        message.toLowerCase().includes("invalid credentials")
      ) {
        setNotice("Invalid email or password.");
      } else if (message.toLowerCase().includes("email not confirmed")) {
        setNotice("Please confirm your email address before signing in.");
      } else {
        setNotice(message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Left Brand Panel */}
      <div className="auth-left">
        <div className="auth-brand-logo">
          <Logo dark />
        </div>

        <div className="auth-brand-copy">
          <div className="auth-badge">
            <Sparkles size={13} />
            <span>AI-Powered Interview Platform</span>
          </div>

          <h1 className="auth-hero-heading">
            Smarter interviews.<br />
            <span>Better hiring.</span>
          </h1>

          <p className="auth-hero-sub">
            AI-powered tools to conduct structured, fair and insightful interviews.
          </p>

          <div className="auth-benefits-list">
            {[
              [ShieldCheck, "Secure & private", "Your interview data stays protected."],
              [Sparkles, "AI-powered", "Turn interview signals into useful insights."],
              [Eye, "Real-time monitoring", "Surface important events while interviews run."],
              [Check, "Clear decisions", "Compare candidates with consistent criteria."]
            ].map(([Icon, title, text]) => (
              <div className="auth-benefit" key={title}>
                <span className="auth-benefit-icon">
                  <Icon size={18} />
                </span>
                <div className="auth-benefit-text">
                  <b>{title}</b>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-left-decor">
          <div className="decor-circle decor-circle-1" />
          <div className="decor-circle decor-circle-2" />
        </div>
      </div>

      {/* Right Auth Card Section */}
      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-logo">
            <Logo />
          </div>

          <div className="auth-header">
            <div className="auth-eyebrow">
              {isRegistering ? "CREATE ACCOUNT" : "WELCOME BACK"}
            </div>
            <h2 className="auth-heading">
              {isRegistering ? "Join Confira" : "Login to Confira"}
            </h2>
            <p className="auth-desc">Choose your workspace and continue.</p>
          </div>

          {/* Candidate / Interviewer Segmented Control */}
          <div className="auth-role-segmented" role="tablist" aria-label="Select role">
            <button
              type="button"
              role="tab"
              aria-selected={role === "candidate"}
              className={`role-seg-btn ${role === "candidate" ? "active" : ""}`}
              onClick={() => setRole("candidate")}
            >
              <UserRound size={16} />
              <span>Candidate</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === "interviewer"}
              className={`role-seg-btn ${role === "interviewer" ? "active" : ""}`}
              onClick={() => setRole("interviewer")}
            >
              <Building2 size={16} />
              <span>Interviewer / Company</span>
            </button>
          </div>

          <form onSubmit={submit} className="auth-form-inner">
            {isRegistering && (
              <div className="auth-field">
                <label htmlFor="auth-fullname">Full name</label>
                <div className="auth-input-box">
                  <UserRound size={18} className="auth-input-icon" />
                  <input
                    id="auth-fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <div className="auth-input-box">
                <Mail size={18} className="auth-input-icon" />
                <input
                  id="auth-email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-input-box">
                <LockKeyhole size={18} className="auth-input-icon" />
                <input
                  id="auth-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  type={show ? "text" : "password"}
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="auth-options-row">
              <label className="auth-remember-label">
                <input type="checkbox" defaultChecked />
                <span>Remember me</span>
              </label>
              {!isRegistering && (
                <button
                  type="button"
                  className="auth-forgot-btn"
                  onClick={() => setNotice("Enter your email, then use this link after the backend is running.")}
                >
                  Forgot password?
                </button>
              )}
            </div>

            <button
              className="auth-submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="auth-spinner" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>{isRegistering ? "Create account" : "Login"}</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {notice && (
            <div
              className={`auth-notice ${
                notice.toLowerCase().includes("invalid") || notice.toLowerCase().includes("error") || notice.toLowerCase().includes("could not")
                  ? "auth-notice-error"
                  : "auth-notice-info"
              }`}
              role="status"
            >
              <span>{notice}</span>
            </div>
          )}

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="auth-social-row">
            <button
              type="button"
              className="auth-social-btn"
              onClick={() => setNotice("Google sign-in is ready for connection.")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              Google
            </button>
            <button
              type="button"
              className="auth-social-btn"
              onClick={() => setNotice("LinkedIn sign-in is ready for connection.")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.64 1.64 0 1 0 0-3.28 1.64 1.64 0 0 0 0 3.28M7.85 18.5V10.1H5.06v8.4h2.79z"/>
              </svg>
              LinkedIn
            </button>
            <button
              type="button"
              className="auth-social-btn"
              onClick={() => setNotice("Microsoft sign-in is ready for connection.")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
              Microsoft
            </button>
          </div>

          <p className="auth-footer-text">
            {isRegistering ? "Already have an account? " : "Don't have an account? "}
            <button
              type="button"
              className="auth-switch-link"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setNotice("");
              }}
            >
              {isRegistering ? "Login" : "Create one"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
