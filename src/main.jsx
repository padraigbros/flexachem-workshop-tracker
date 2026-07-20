import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { ThemeProvider, useTheme } from "./state/ThemeProvider";
import { AuthProvider } from "./state/AuthProvider";
import { WorkshopProvider } from "./state/WorkshopProvider";
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <WorkshopProvider>
          <NotificationsProvider>
            <NativeBridge />
            <RouterProvider router={router} />
            <RecoveryModal />
            <ThemedToaster />
          </NotificationsProvider>
        </WorkshopProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
