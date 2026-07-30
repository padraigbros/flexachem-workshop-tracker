import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { router } from "./router";
import { ThemeProvider, useTheme } from "./state/ThemeProvider";
import { AuthProvider } from "./state/AuthProvider";
import { WorkshopProvider } from "./state/WorkshopProvider";
import { StatusPromptProvider } from "./state/StatusPromptProvider";
import { NotificationsProvider } from "./state/NotificationsProvider";
import { RecoveryModal } from "./components/jobs/RecoveryModal";
import { initMonitoring, identifyUser } from "./lib/monitoring";
import { initNativeShell, setStatusBarTheme } from "./lib/native";
import { initPush, teardownPush } from "./lib/push";
import { useAuthCtx } from "./state/AuthProvider";
import "./styles/app.css";

// Keeps the native status bar in sync with the theme, wires the back button, and
// registers for push once a user is signed in; renders nothing.
function NativeBridge() {
  const { resolved } = useTheme();
  const { user } = useAuthCtx();
  useEffect(() => { setStatusBarTheme(resolved); }, [resolved]);
  useEffect(() => { initNativeShell(router.navigate); }, []);
  // Attach the signed-in account to every error report, so "is this everyone or just Anna?"
  // is answerable without asking anyone.
  useEffect(() => { identifyUser(user); }, [user?.id, user?.email, user?.name]);
  useEffect(() => {
    if (!user?.id) return;
    initPush(user.id, router.navigate);
    return () => { teardownPush(user.id); };
  }, [user?.id]);
  return null;
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster richColors position="top-right" theme={resolved} closeButton />;
}

// Deploys apply themselves. skipWaiting + clientsClaim (vite.config.js) let a new service
// worker activate and take over open tabs immediately; the controllerchange listener below
// then reloads the page onto the new assets. This is the main defence against the "Failed
// to fetch dynamically imported module" crash, where a tab left open across a deploy tries
// to lazy-load a chunk the CDN no longer serves. RouteErrorBoundary is the safety net.
// Before anything else, so an exception thrown during boot is still captured.
initMonitoring();

const UPDATE_CHECK_MS = 60 * 60 * 1000;

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // A tab that is never reloaded would otherwise never notice a deploy — poll hourly and
    // whenever it regains focus, so a workshop tablet left open all day stays current.
    const check = () => { if (navigator.onLine) registration.update().catch(() => {}); };
    setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
  },
});

if ("serviceWorker" in navigator) {
  let reloading = false;
  // A first-ever install also fires controllerchange (nothing controlled the page before).
  // Only reload when REPLACING an existing controller — i.e. a genuine update — otherwise
  // every first visit would reload itself once for no reason.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <WorkshopProvider>
          <StatusPromptProvider>
            <NotificationsProvider>
              <NativeBridge />
              <RouterProvider router={router} />
              <RecoveryModal />
              <ThemedToaster />
            </NotificationsProvider>
          </StatusPromptProvider>
        </WorkshopProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
