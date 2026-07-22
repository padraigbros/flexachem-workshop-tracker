import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { router } from "./router";
import { ThemeProvider, useTheme } from "./state/ThemeProvider";
import { AuthProvider } from "./state/AuthProvider";
import { WorkshopProvider } from "./state/WorkshopProvider";
import { StatusPromptProvider } from "./state/StatusPromptProvider";
import { NotificationsProvider } from "./state/NotificationsProvider";
import { RecoveryModal } from "./components/jobs/RecoveryModal";
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

// Nudge an idle open tab to refresh once a new deploy's service worker is ready — the
// main defence against the "Failed to fetch dynamically imported module" crash, which
// happens when a tab left open across a deploy tries to lazy-load a chunk the CDN no
// longer serves. RouteErrorBoundary is the safety net if this is missed or dismissed.
const updateApp = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast("A new version of the app is available", {
      description: "Refresh to get the latest features and fixes.",
      duration: Infinity,
      action: { label: "Refresh", onClick: () => updateApp() },
    });
  },
});

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
