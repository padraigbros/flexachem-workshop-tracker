// Android push notifications (FCM) via Capacitor. Guarded like native.js so it is a
// complete no-op on the web build and in demo mode (no Supabase). Only does anything
// once the Firebase setup in BUILD_APK.md is complete and google-services.json is present.
import { supabase } from "./supabase";
import { isNative } from "./native";

let registered = false;

// Request permission, register with FCM, and persist the device token to push_tokens.
// `navigate` is the router.navigate function so a tapped notification can deep-link.
export async function initPush(userId, navigate) {
  if (!isNative || !supabase || !userId || registered) return;
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
