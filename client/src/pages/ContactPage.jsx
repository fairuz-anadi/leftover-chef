import { useMemo, useState } from "react";
import { api } from "../api/api";
import { useToast } from "../components/useToast";

export default function ContactPage({ user, onRequireAuth }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const { showToast } = useToast();
  const contactIdentity = useMemo(
    () => ({
      name: user?.name || "",
      email: user?.email || "",
    }),
    [user]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!user) {
      onRequireAuth?.();
      return;
    }

    try {
      await api.contact({ ...contactIdentity, message });
      showToast("Your message has been sent.");
      setMessage("");
    } catch (submitError) {
      setError(submitError.message);
      showToast(submitError.message, "error");
    }
  }

  return (
    <div className="simple-page">
      <p className="eyebrow">Contact Admin</p>
      <h1>Report issues or ask for help.</h1>
      <form className="stack-form recipe-form" onSubmit={handleSubmit}>
        <input
          placeholder="Your name"
          readOnly
          value={contactIdentity.name}
          required
        />
        <input
          type="email"
          placeholder="Your email"
          value={contactIdentity.email}
          readOnly
          required
        />
        <textarea
          placeholder="Tell the admin what went wrong"
          rows="7"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
        />
        {error && <p className="form-error">{error}</p>}
        {user ? (
          <button className="button" type="submit">
            Send Message
          </button>
        ) : (
          <button className="button" onClick={onRequireAuth} type="button">
            Log In to Contact Admin
          </button>
        )}
      </form>
    </div>
  );
}