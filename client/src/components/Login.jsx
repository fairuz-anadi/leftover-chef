import { useState, useEffect } from "react";
import "./Login.css";
import logo from "../assets/logo.png";

import ForgotPassword from "./ForgotPassword";

export default function Login({ onClose, onLoginSuccess, onSwitchToSignup, onSwitchToForgot }) {
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!loginForm.email || !loginForm.password) {
      setLoginError("Please fill in all fields.");
      return;
    }
    // Replace this block with your real auth logic (e.g. API call, Firebase, etc.)
    onLoginSuccess();
    onClose();
    setLoginError("");
    setLoginForm({ email: "", password: "" });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>

        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className="modal-header">
          <div className="modal-logo">
            <img src={logo} alt="Leftover Chef" style={{ width: "100px", height: "100px", objectFit: "contain" }} />
          </div>
          <h2 className="modal-title">Welcome back</h2>
          <p className="modal-subtitle">Sign in to cook from what you already have</p>
        </div>

        <form className="modal-form" onSubmit={handleLogin}>
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
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="form-input-wrap">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8a7060" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
          </div>

          {loginError && <p className="form-error">{loginError}</p>}

          <div className="form-meta">
            <label className="form-check">
              <input type="checkbox" /> Remember me
            </label>
            <button
              type="button"
              className="form-link"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
              onClick={() => { onClose(); onSwitchToForgot?.(); }}
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" className="modal-submit">
            Sign In
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </form>

        <p className="modal-signup">
          Don't have an account?{" "}
          <button
            type="button"
            className="form-link"
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
            onClick={() => { onClose(); onSwitchToSignup?.(); }}
          >
            Create one
          </button>
        </p>

      </div>
    </div>
  );
}