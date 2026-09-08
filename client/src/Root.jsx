import { useCallback, useEffect, useState } from "react";
import App from "./App.jsx";
import Landing from "./Landing.jsx";
import KitchenAddress from "./components/KitchenAddress.jsx";
import { isNativeApp, kitchenHost } from "./api";

/**
 * Which screen, and — in the Android app — whether we know where the kitchen
 * is yet.
 *
 * On the web there are two screens. `/` is the landing page: what sits on the
 * laptop between judges, and what a phone lands on first. `/app` is the fridge,
 * and it is where the installed app starts, because somebody who has already
 * put this on their home screen does not need the pitch again.
 *
 * In the APK there is no landing page and no URL bar to have an opinion about.
 * It opens on the fridge, having first asked once for the laptop's address,
 * because the screens ship inside the APK but the fridge does not.
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
  const [view, setView] = useState(() =>
    // The APK has no address bar, so there is nothing for a landing page to be
    // the front of. Straight to the fridge.
    isNativeApp ? "app" : viewFor(window.location.pathname)
  );
  const [connected, setConnected] = useState(() => !isNativeApp || !!kitchenHost());
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (isNativeApp) return undefined;
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

  if (isNativeApp && (!connected || reconnecting)) {
    return (
      <KitchenAddress
        onConnected={() => {
          setConnected(true);
          setReconnecting(false);
        }}
        onCancel={reconnecting ? () => setReconnecting(false) : null}
      />
    );
  }

  if (view === "landing") {
    return <Landing onOpen={() => navigate("/app")} />;
  }

  return (
    <App
      onHome={isNativeApp ? null : () => navigate("/")}
      onChangeKitchen={isNativeApp ? () => setReconnecting(true) : null}
    />
  );
}
