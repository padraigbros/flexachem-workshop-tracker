// Android push notifications (FCM) via Capacitor. Guarded like native.js so it is a
// complete no-op on the web build and in demo mode (no Supabase).
//
// IMPORTANT: push registration calls into Firebase (FCM getToken). Without a configured
// FirebaseApp — i.e. before google-services.json + the google-services Gradle plugin are
// added per BUILD_APK.md — register() throws a NATIVE exception that crashes the app right
// after the user grants the notification permission (a JS try/catch cannot catch it).
// So push stays OFF unless VITE_ENABLE_PUSH=true is set at build time. Only turn it on
// AFTER the Firebase setup is complete, or the app will crash on "Allow".
import { supabase } from "./supabase";
import { isNative } from "./native";

const PUSH_ENABLED = import.meta.env.VITE_ENABLE_PUSH === "true";
let registered = false;

// Request permission, register with FCM, and persist the device token to push_tokens.
// `navigate` is the router.navigate function so a tapped notification can deep-link.
export async function initPush(userId, navigate) {
  if (!PUSH_ENABLED || !isNative || !supabase || !userId || registered) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const perm = await PushNotifications.requestPermissions(); // handles Android 13 POST_NOTIFICATIONS
    if (perm.receive !== "granted") return;
    registered = true;

    await PushNotifications.addListener("registration", async (token) => {
      try {
        await supabase.from("push_tokens").upsert({
          token: token.value,
          user_id: userId,
          platform: "android",
          updated_at: new Date().toISOString(),
        });
      } catch { /* best effort */ }
    });

    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const jobId = action?.notification?.data?.job_id;
      if (jobId && navigate) navigate(`/?job=${jobId}`);
    });

    await PushNotifications.register();
  } catch { /* push unavailable */ }
}

// Best-effort token removal on sign-out so a shared device stops receiving a user's alerts.
export async function teardownPush(userId) {
  registered = false;
  if (!isNative || !supabase || !userId) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllListeners();
    // We don't keep the token client-side; clearing this device's rows for the user is enough.
    await supabase.from("push_tokens").delete().eq("user_id", userId);
  } catch { /* best effort */ }
}
