import { ArrowRight, BrainCircuit, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "../../components/Logo";

export default function LandingPage() {
  return (
    <div className="landing">
      <nav className="landing-nav container">
        <Logo dark />
      </nav>

      <section className="hero container">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15} /> AI-powered hiring intelligence</div>
          <h1>Smarter interviews.<br /><span>Better hiring.</span></h1>
          <p>Confira helps companies evaluate candidates with structured interviews, real-time integrity signals, AI-assisted answer analysis, and clear hiring reports.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-lg" to="/auth">Get started <ArrowRight size={18} /></Link>
          </div>
          <div className="trust-row"><ShieldCheck size={18} /> Secure candidate data <span /> <BrainCircuit size={18} /> AI-assisted evaluation <span /> <Eye size={18} /> Real-time monitoring</div>
        </div>

      </section>

      <footer className="landing-footer"><div className="container"><Logo /><span>© 2026 Confira. AI-assisted hiring, built for people.</span></div></footer>
    </div>
  );
}