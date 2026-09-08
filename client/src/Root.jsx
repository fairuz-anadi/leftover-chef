import { useCallback, useEffect, useState } from "react";
import App from "./App.jsx";
import Landing from "./Landing.jsx";

/**
 * Two screens, and the smallest thing that can choose between them.
 *
 * `/` is the landing page — what sits on the laptop between judges, and what a
 * phone lands on the first time. `/app` is the fridge itself, and it is where
 * the installed app starts, because somebody who has already put this on their
 * home screen does not need the pitch again.
 *
 * This is pushState and a popstate listener rather than a router library. A
 * router would be a dependency, a bundle and a build step to buy one decision
 * that fits in twenty lines — and the app underneath genuinely has one screen,
 * so there is no second route coming that would justify it.
 */

function viewFor(pathname) {
  return pathname.replace(/\/+$/, "") === "" ? "landing" : "app";
}

export default function Root() {
  const [view, setView] = useState(() => viewFor(window.location.pathname));

  useEffect(() => {
    // The browser's back button, and anything else that moves history.
    const onPopState = () => setView(viewFor(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setView(viewFor(path));
    // Straight to the top, with no smooth scroll — this is a different screen,
    // not a jump within one, and animating it just looks like a glitch.
    window.scrollTo(0, 0);
  }, []);

  if (view === "landing") {
    return <Landing onOpen={() => navigate("/app")} />;
  }

  return <App onHome={() => navigate("/")} />;
}
