import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";
import { router } from "./router";
import { ThemeProvider, useTheme } from "./state/ThemeProvider";
import { AuthProvider } from "./state/AuthProvider";
import { WorkshopProvider } from "./state/WorkshopProvider";
import { RecoveryModal } from "./components/jobs/RecoveryModal";
import { initNativeShell, setStatusBarTheme } from "./lib/native";
import "./styles/app.css";

// Keeps the native status bar in sync with the theme; renders nothing.
function NativeBridge() {
  const { resolved } = useTheme();
  useEffect(() => { setStatusBarTheme(resolved); }, [resolved]);
  useEffect(() => { initNativeShell(router.navigate); }, []);
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
          <NativeBridge />
          <RouterProvider router={router} />
          <RecoveryModal />
          <ThemedToaster />
        </WorkshopProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
