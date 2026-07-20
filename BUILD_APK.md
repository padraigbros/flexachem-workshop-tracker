# Building the Android APK

The app ships as a [Capacitor](https://capacitorjs.com) wrapper around the web build.
The web layer, PWA manifest/service worker, and the native Android project (`android/`)
are all committed and ready — you only need a local Android toolchain to compile the APK.

## One-time prerequisites (Windows)

> Status on this machine (2026-07-20): all set up and verified — a debug APK builds
> successfully. The values below reflect what actually works here.

1. **Android Studio** — installed at `C:\Program Files\Android\Android Studio1` (a second,
   complete install; the older `…\Android Studio` folder has a broken JBR with no `java.exe`).
2. **JDK 21** — use the JBR bundled with the *complete* install (AGP 8.13 needs JDK 17–21; the
   system `java` is 26, too new for Gradle here):
   ```powershell
   setx JAVA_HOME "C:\Program Files\Android\Android Studio1\jbr"
   ```
3. **Android SDK** — Platform 36 + Build-Tools 35/36 are already installed. Set:
   ```powershell
   setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
   ```
4. **HTTPS inspection / truststore** — this machine re-signs HTTPS with a private root CA, so
   Gradle can't download dependencies with the default JDK truststore *or* the JBR's
   `WINDOWS-ROOT` setting (the JBR lacks the provider for it). `android/gradle.properties`
   therefore points Gradle at `android/proxy-cacerts.p12`, a PKCS12 truststore built from the
   Windows root store. If dependency downloads start failing with SSL/PKIX errors after the
   machine's roots change, regenerate it with `powershell -File tools/regen-truststore.ps1`
   (see the comment in `gradle.properties`). `proxy-cacerts.p12` is machine-specific — don't
   commit it to a shared repo/CI.
5. Open a fresh terminal so the new environment variables take effect.

## Build a debug APK

```powershell
npm run apk
```

This runs `vite build` → `cap sync android` → `gradlew assembleDebug`. The APK lands at:

```
android\app\build\outputs\apk\debug\Flexachem.apk
```
(A signed release build lands at `android\app\build\outputs\apk\release\Flexachem.apk`.)

Install it on a device with `adb install -r <path>` or drag it onto an emulator.

Alternatively open the project in Android Studio and press *Run*:

```powershell
npm run open:android
```

## Release (signed) APK / AAB

1. Create a keystore (keep it safe and **out of git** — `.gitignore` already excludes `*.keystore`):
   ```powershell
   keytool -genkeypair -v -keystore flexachem.keystore -alias flexachem -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android/keystore.properties` (also git-ignored):
   ```
   storeFile=../../flexachem.keystore
   storePassword=<password>
   keyAlias=flexachem
   keyPassword=<password>
   ```
3. Reference it from a `signingConfigs.release` block in `android/app/build.gradle`, then:
   ```powershell
   cd android; .\gradlew assembleRelease   # APK
   cd android; .\gradlew bundleRelease      # AAB for the Play Store
   ```

## Push notifications (Android FCM) — optional

The in-app notification bell works without any of this. These steps add real push
notifications so a tagged teammate is alerted even when the app is closed. Everything
here is additive — skip it and the rest of the app is unaffected.

**1. Firebase project**
- In the [Firebase console](https://console.firebase.google.com), create a project.
- Add an **Android app** with package name `com.flexachem.workshop`.
- Download `google-services.json` and place it at `android/app/google-services.json`.
  It is git-ignored (contains project keys) — keep it out of source control.

**2. Client plugin** (already added to `package.json`)
```powershell
npm install          # ensures @capacitor/push-notifications is present
npx cap sync android
```

**3. Gradle wiring** (Capacitor does not add these automatically)
- In `android/build.gradle` `buildscript { dependencies { ... } }` add:
  `classpath 'com.google.gms:google-services:4.4.2'`
- At the very bottom of `android/app/build.gradle` add:
  `apply plugin: 'com.google.gms.google-services'`

**4. Service account for the server**
- Firebase console → *Project settings* → *Service accounts* → **Generate new private key**.
  This JSON lets the Edge Function send via FCM HTTP v1.

**5. Edge Function** (`supabase/functions/notify-push/`)
```powershell
supabase login
supabase link --project-ref <your-project-ref>
supabase secrets set PUSH_WEBHOOK_SECRET=<a-random-string>
supabase secrets set FCM_SERVICE_ACCOUNT="$(Get-Content service-account.json -Raw)"
supabase functions deploy notify-push
```

**6. Database Webhook**
- Dashboard → *Database* → *Webhooks* → **Create a new hook** on table
  `public.notifications`, event **INSERT**, type **HTTP Request** → POST to the
  `notify-push` function URL.
- Add an HTTP header `X-Webhook-Secret` with the same value you set for
  `PUSH_WEBHOOK_SECRET`.

Once deployed, an @-mention inserts a `notifications` row → the webhook fires →
`notify-push` looks up the tagged user's device tokens in `push_tokens` and sends the FCM
message. Tapping the notification deep-links to the job (`/?job=<id>`). Android 13+ shows a
runtime permission prompt on first launch, handled by the plugin.

## Notes

- **Environment / Supabase:** the APK bakes in whatever `.env.local` held at build time.
  For a production build, ensure `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are present,
  or the app ships in local demo mode.
- **App ID:** `com.flexachem.workshop` (see `capacitor.config.json`).
- **Password resets** open the web app (the Supabase Site URL), then users sign into the app.
- After changing web code, always re-run `npm run build:android` (or `npm run apk`) so the
  native project picks up the new `dist/`.
