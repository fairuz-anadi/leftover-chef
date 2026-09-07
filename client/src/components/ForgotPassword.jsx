import { useState, useEffect } from "react";
import "./ForgotPassword.css";
import logo from "../assets/logo.png";

export default function ForgotPassword({ onClose, onSwitchToLogin }) {
  const [email, setEmail]     = useState("");
  const [error, setError]     = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    // ── Replace with your real reset logic (API call, Firebase, etc.) ──
    setError("");
    setSubmitted(true);
  };

  return (
    <div className="fp-overlay" onClick={onClose}>
      <div className="fp-card" onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button className="fp-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* Header */}
        <div className="fp-header">
          <div className="fp-logo">
            <img src={logo} alt="Leftover Chef" style={{ width: "100px", height: "100px", objectFit: "contain" }} />
          </div>
          <h2 className="fp-title">
            {submitted ? "Check your inbox" : "Forgot password?"}
          </h2>
          <p className="fp-subtitle">
            {submitted
              ? `We've sent a reset link to ${email}. Check your spam folder if you don't see it.`
              : "No worries — enter your email and we'll send you a reset link."}
          </p>
        </div>

        {/* Success state */}
        {submitted ? (
          <div className="fp-success">
            <div className="fp-success-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#27ae60" strokeWidth="2.5">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <p className="fp-success-text">
              Didn't receive it?{" "}
              <button
                type="button"
                className="form-link"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
                onClick={() => { setSubmitted(false); setEmail(""); }}
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          /* Form */
          <form className="fp-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <div className="form-input-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a7060" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  autoFocus
                />
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="fp-submit">
              Send Reset Link
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </form>
        )}

        {/* Back to login */}
        <p className="fp-back">
          <button
            type="button"
            className="fp-back-btn"
            onClick={() => { onClose(); onSwitchToLogin?.(); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Sign In
          </button>
        </p>

      </div>
    </div>
  );
}
