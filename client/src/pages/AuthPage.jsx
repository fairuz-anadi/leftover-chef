import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AuthPage.css";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  password_confirmation: "",
};

function getErrorMessage(error) {
  const data = error?.response?.data;

  if (data?.message) {
    return data.message;
  }

  const fieldErrors = data?.errors ? Object.values(data.errors).flat() : [];

  if (fieldErrors.length > 0) {
    return fieldErrors[0];
  }

  return "Something went wrong. Please try again.";
}

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const navigate = useNavigate();
  const { isAuthenticated, authLoading, signIn, signUp } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!authLoading && isAuthenticated) {
    return <Navigate to="/profile" replace />;
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (isLogin) {
        await signIn({
          email: form.email,
          password: form.password,
        });
      } else {
        await signUp(form);
      }

      navigate("/profile");
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-intro">
          <span className="auth-kicker">{isLogin ? "Welcome Back" : "Join Leftover Chef"}</span>
          <h1>{isLogin ? "Sign in to your kitchen." : "Create your cooking profile."}</h1>
          <p>
            {isLogin
              ? "Pick up your saved recipes, profile, and protected API access."
              : "Make an account to save your identity, create tokens, and start sharing recipes."}
          </p>
          <div className="auth-feature-list">
            <div>Personal API token issued on sign in</div>
            <div>Protected recipe creation with Sanctum</div>
            <div>Profile page synced from Laravel</div>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{isLogin ? "Login" : "Sign Up"}</h2>
            <p>{isLogin ? "Use your email and password." : "Fill in your details to get started."}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <label className="auth-field">
                <span>Name</span>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Leftover Chef"
                  required
                />
              </label>
            )}

            <label className="auth-field">
              <span>Email</span>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Minimum 8 characters"
                required
              />
            </label>

            {!isLogin && (
              <label className="auth-field">
                <span>Confirm Password</span>
                <input
                  name="password_confirmation"
                  type="password"
                  value={form.password_confirmation}
                  onChange={handleChange}
                  placeholder="Repeat your password"
                  required
                />
              </label>
            )}

            {error && <p className="auth-error">{error}</p>}

            <button className="auth-submit" type="submit" disabled={submitting}>
              {submitting ? "Please wait..." : isLogin ? "Sign In" : "Create Account"}
            </button>
          </form>

          <p className="auth-switch">
            {isLogin ? "Need an account?" : "Already registered?"}{" "}
            <Link to={isLogin ? "/signup" : "/login"}>{isLogin ? "Sign up" : "Login"}</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
