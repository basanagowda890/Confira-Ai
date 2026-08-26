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
    setNotice(""); setLoading(true);
    try {
      const result = isRegistering ? await register({ email, password, fullName, role }) : await login(email, password);
      if (result.confirmationRequired) { setNotice("Account created. Please confirm your email, then log in."); setIsRegistering(false); return; }
      const userRole = result.profile?.role || result.role;
      navigate(userRole === "candidate" ? "/candidate/dashboard" : "/interviewer/dashboard", { replace: true });
    } catch (error) {
      const message = error.message || "We could not sign you in. Please try again.";
      setNotice(message.includes("Invalid login") ? "Invalid email or password." : message);
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <Logo dark />
        <div className="auth-brand-copy">
          <div className="hero-kicker light"><Sparkles size={15} /> Intelligent interview platform</div>
          <h1>Smarter interviews.<br /><span>Better hiring.</span></h1>
          <p>AI-powered tools to conduct structured, fair and insightful interviews.</p>
          {[
            [ShieldCheck, "Secure & private", "Your interview data stays protected."],
            [Sparkles, "AI-powered", "Turn interview signals into useful insights."],
            [Eye, "Real-time monitoring", "Surface important events while the interview runs."],
            [Check, "Clear decisions", "Compare candidates with consistent criteria."]
          ].map(([Icon, title, text]) => <div className="auth-benefit" key={title}><span><Icon size={18} /></span><div><b>{title}</b><p>{text}</p></div></div>)}
        </div>
        <div className="auth-art"><div className="orb orb-a" /><div className="orb orb-b" /><div className="laptop-shape" /></div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <div className="mobile-auth-logo"><Logo /></div>
          <div className="auth-title"><div className="eyebrow">{isRegistering ? "CREATE ACCOUNT" : "WELCOME BACK"}</div><h2>{isRegistering ? "Join Confira" : "Login to Confira"}</h2><p>Choose your workspace and continue.</p></div>

          <div className="role-tabs">
            <button className={role === "candidate" ? "active" : ""} onClick={() => setRole("candidate")}><UserRound size={18} /> Candidate</button>
            <button className={role === "interviewer" ? "active" : ""} onClick={() => setRole("interviewer")}><Building2 size={18} /> Interviewer / Company</button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {isRegistering && <label>Full name<div className="input-wrap"><UserRound size={18} /><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required /></div></label>}
            <label>Email address<div className="input-wrap"><Mail size={18} /><input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" required /></div></label>
            <label>Password<div className="input-wrap"><LockKeyhole size={18} /><input value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" type={show ? "text" : "password"} required /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
            <div className="form-row"><label className="check-label"><input type="checkbox" defaultChecked /> Remember me</label>{!isRegistering && <button type="button" className="text-link" onClick={() => setNotice("Enter your email, then use this link after the backend is running.")}>Forgot password?</button>}</div>
            <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading}>{loading ? "Please wait…" : isRegistering ? "Create account" : "Login"} <ArrowRight size={18} /></button>
          </form>

          <div className="or"><span>or continue with</span></div>
          <div className="social-grid"><button type="button" onClick={() => setNotice("Google sign-in is ready for connection.")}>Google</button><button type="button" onClick={() => setNotice("LinkedIn sign-in is ready for connection.")}>LinkedIn</button><button type="button" onClick={() => setNotice("Microsoft sign-in is ready for connection.")}>Microsoft</button></div>
          <p className="auth-foot">{isRegistering ? "Already have an account? " : "Don't have an account? "}<button type="button" className="text-link" onClick={() => { setIsRegistering(!isRegistering); setNotice(""); }}>{isRegistering ? "Login" : "Create one"}</button></p>
          {notice && <p className="form-notice" role="status">{notice}</p>}
        </div>
      </div>
    </div>
  );
}
