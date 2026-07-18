# Building the Android APK

The app ships as a [Capacitor](https://capacitorjs.com) wrapper around the web build.
The web layer, PWA manifest/service worker, and the native Android project (`android/`)
are all committed and ready — you only need a local Android toolchain to compile the APK.

## One-time prerequisites (Windows)

1. **Android Studio** (current version — Hedgehog/Iguana or newer). The version currently
   on this machine (`AI-201`, 2020) is too old for Capacitor 8 and must be updated.
2. **JDK 21** — Android Studio bundles one. Point the shell at it:
   ```powershell
   setx JAVA_HOME "C:\Program Files\Android\Android Studio\jbr"
   ```
3. **Android SDK** — in Android Studio → *SDK Manager*, install **SDK Platform 35** and the
   latest **Build Tools**. Then set:
   ```powershell
   setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
   ```
4. Open a fresh terminal so the new environment variables take effect.

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

## Notes

- **Environment / Supabase:** the APK bakes in whatever `.env.local` held at build time.
  For a production build, ensure `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are present,
  or the app ships in local demo mode.
- **App ID:** `com.flexachem.workshop` (see `capacitor.config.json`).
- **Password resets** open the web app (the Supabase Site URL), then users sign into the app.
- After changing web code, always re-run `npm run build:android` (or `npm run apk`) so the
  native project picks up the new `dist/`.
