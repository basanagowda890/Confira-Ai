import { ArrowRight, BrainCircuit, Eye, ShieldCheck, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "../../components/Logo";

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Background Technology / Orbital Accents */}
      <div className="landing-bg-decor" aria-hidden="true">
        <div className="landing-orbit orbit-1" />
        <div className="landing-orbit orbit-2" />
        <div className="landing-glow glow-blue" />
        <div className="landing-glow glow-gold" />
        <div className="landing-grid-mesh" />
        <div className="landing-floating-dot dot-1" />
        <div className="landing-floating-dot dot-2" />
        <div className="landing-floating-dot dot-3" />
      </div>

      {/* Top Navigation */}
      <header className="landing-header">
        <nav className="landing-nav container">
          <Logo dark />
          <div className="landing-nav-actions">
            <Link className="landing-nav-link" to="/auth">Sign In</Link>
            <Link className="btn btn-primary btn-sm" to="/auth">
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="hero-wrap">
        <section className="hero container hero-centered">
          <div className="hero-copy">
            <div className="hero-badge">
              <Sparkles size={14} className="hero-badge-icon" />
              <span>AI-Powered Hiring Intelligence</span>
            </div>

            <h1 className="hero-heading">
              Smarter interviews.<br />
              <span className="hero-heading-gradient">Better hiring.</span>
            </h1>

            <p className="hero-description">
              Confira helps companies evaluate candidates with structured interviews,
              real-time integrity signals, AI-assisted answer analysis, and clear hiring reports.
            </p>

            <div className="hero-actions">
              <Link className="btn btn-primary btn-lg hero-cta-btn" to="/auth">
                <span>Get started</span>
                <ArrowRight size={18} />
              </Link>
            </div>

            {/* Feature Highlights Row */}
            <div className="hero-features-row">
              <div className="hero-feature-card">
                <div className="feature-card-icon">
                  <ShieldCheck size={18} />
                </div>
                <div className="feature-card-text">
                  <b>Secure candidate data</b>
                  <span>Protected & private</span>
                </div>
              </div>

              <div className="hero-feature-card">
                <div className="feature-card-icon">
                  <BrainCircuit size={18} />
                </div>
                <div className="feature-card-text">
                  <b>AI-assisted evaluation</b>
                  <span>Objective insights</span>
                </div>
              </div>

              <div className="hero-feature-card">
                <div className="feature-card-icon">
                  <Eye size={18} />
                </div>
                <div className="feature-card-text">
                  <b>Real-time monitoring</b>
                  <span>Live integrity signals</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container landing-footer-inner">
          <Logo />
          <span>© 2026 Confira. AI-assisted hiring, built for people.</span>
        </div>
      </footer>
    </div>
  );
}