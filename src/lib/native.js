// Native-shell integration. Everything is guarded so the module is a no-op on the web.
// Capacitor injects a global at runtime inside the WebView; the web build never sees it.
import { Capacitor } from "@capacitor/core";

export const isNative = Capacitor.isNativePlatform();

// Light haptic feedback on interactions (kanban drop, status change, FAB).
export async function impact(style = "light") {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: map[style] || ImpactStyle.Light });
  } catch { /* haptics unavailable */ }
}

// Set the native status-bar colour to match the current theme.
export async function setStatusBarTheme(resolved) {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: resolved === "dark" ? "#071426" : "#0a1f3d" });
  } catch { /* status bar unavailable */ }
}

// Wire the Android hardware back button to close overlays, navigate back, then minimise.
export async function initNativeShell(navigate) {
  if (!isNative) return;
  try {
    const { App } = await import("@capacitor/app");
    App.addListener("backButton", ({ canGoBack }) => {
      const params = new URLSearchParams(window.location.search);
      if (params.has("job") || params.has("panel")) {
        params.delete("job"); params.delete("panel");
        navigate(`${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
        return;
      }
      if (canGoBack || (window.history.state?.idx ?? 0) > 0) navigate(-1);
      else App.exitApp();
    });
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch { /* native APIs unavailable */ }
}
