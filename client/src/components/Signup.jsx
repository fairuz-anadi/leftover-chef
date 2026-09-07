import { useState, useEffect } from "react";
import "./Signup.css";
import logo from "../assets/logo.png";

// ── Password strength helper ──────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: "", cls: "" };
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))            score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))     score++;
  const map = ["", "weak", "fair", "good", "strong"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[score], cls: map[score] };
}

// ── Eye icon ──────────────────────────────────────────────────────────────────
function EyeIcon({ open }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Signup({ onClose, onSignupSuccess, onSwitchToLogin }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const strength = getStrength(form.password);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const set = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const validate = () => {
    if (!form.firstName.trim() || !form.lastName.trim())
      return "Please enter your full name.";
    if (!form.username.trim())
      return "Please choose a username.";
    if (form.username.length < 3)
      return "Username must be at least 3 characters.";
    if (!/^[a-zA-Z0-9_]+$/.test(form.username))
      return "Username can only contain letters, numbers, and underscores.";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email))
      return "Please enter a valid email address.";
    if (form.password.length < 8)
      return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword)
      return "Passwords do not match.";
    return null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    // ── Replace with your real signup logic (API call, Firebase, etc.) ──
    onSignupSuccess?.();
    onClose();
  };

  // Strength bar active class
  const barClass = (index) => {
    if (!form.password || strength.score === 0) return "";
    if (index < strength.score) return `active-${strength.cls}`;
    return "";
  };

  return (
    <div className="signup-overlay" onClick={onClose}>
      <div className="signup-card" onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button className="signup-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        {/* Header */}
        <div className="signup-header">
          <div className="signup-logo">
            <img src={logo} alt="Leftover Chef" style={{ width: "100px", height: "100px", objectFit: "contain" }} />
          </div>
          <h2 className="signup-title">Join Leftover Chef</h2>
          <p className="signup-subtitle">Create your account and start sharing world-class recipes</p>
        </div>

        {/* Form */}
        <form className="signup-form" onSubmit={handleSubmit}>

          {/* Name row */}
          <div className="signup-row">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <div className="form-input-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a7060" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Jane"
                  value={form.firstName}
                  onChange={set("firstName")}
                  autoFocus
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <div className="form-input-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a7060" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={set("lastName")}
                />
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="form-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a7060" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                type="text"
                className="form-input"
                placeholder="chef_jane"
                value={form.username}
                onChange={set("username")}
              />
            </div>
            <p className="field-hint">Letters, numbers, and underscores only</p>
          </div>

          {/* Email */}
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
                value={form.email}
                onChange={set("email")}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="form-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a7060" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? "text" : "password"}
                className="form-input"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={set("password")}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
            {form.password && (
              <div className="pw-strength">
                <div className="pw-strength-bars">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className={`pw-bar ${barClass(i)}`} />
                  ))}
                </div>
                <span className={`pw-strength-label ${strength.cls}`}>
                  {strength.label} password
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <div
              className={`form-input-wrap ${
                form.confirmPassword
                  ? form.confirmPassword === form.password
                    ? "is-valid"
                    : "has-error"
                  : ""
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a7060" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <input
                type={showConfirm ? "text" : "password"}
                className="form-input"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={set("confirmPassword")}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide" : "Show"}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className="form-error">{error}</p>}

          {/* Submit */}
          <button type="submit" className="signup-submit">
            Create Account
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </form>

        {/* Footer */}
        <p className="signup-login">
          Already have an account?{" "}
          {onSwitchToLogin ? (
            <button
              type="button"
              className="form-link"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
              onClick={() => { onClose(); onSwitchToLogin(); }}
            >
              Sign in
            </button>
          ) : (
            <a href="/login" className="form-link">Sign in</a>
          )}
        </p>

      </div>
    </div>
  );
}