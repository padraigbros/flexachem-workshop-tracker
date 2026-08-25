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

The keystore and `android/keystore.properties` already exist on this machine, and
`signingConfigs.release` in `android/app/build.gradle` reads them. **Back `flexachem.keystore`
up somewhere off this machine** — since it is now also the Play *app signing* key (below),
losing it is unrecoverable.

**Both shipping artifacts must come off ONE `cap sync`**, or they are two different apps
wearing the same version number:

```powershell
$env:VITE_COMMIT_SHA = (git rev-parse --short HEAD); npm run build:android
cd android; .\gradlew assembleRelease bundleRelease
```

- `android\app\build\outputs\bundle\release\app-release.aab` → Play
- `android\app\build\outputs\apk\release\Flexachem.apk` → sideload fallback

`VITE_COMMIT_SHA` becomes Sentry's `release` (Vercel sets it for the web build), so a mobile
crash says which commit it came from. `npm run apk:release` and `npm run aab` wrap the same
thing for a single artifact.

**Bump `versionCode` in `android/app/build.gradle` before every Play upload** — Play rejects a
duplicate. Gaps are harmless.

### Verify the artifact, not the build log

1. `output-metadata.json` next to the APK must show the versionCode/Name you expect; for the
   AAB read it back (`bundletool dump manifest`) rather than assuming it inherited.
2. Unzip and take the entry chunk **named by `assets/public/index.html`** — there are several
   tiny `assets/index-*.js` files and grepping the wrong one gives a confident zero. It must
   contain the production project ref and, since 2.4, `ingest.de.sentry.io`.
3. `apksigner verify --print-certs` on the release APK -> `CN=Flexachem Workshop`,
   SHA-256 `95150bc3...b274c0fd`. Play checks this on UPLOAD (it is the registered upload
   key). It is NOT what ends up on a phone from Play - see the signing note below.

### Google Play - internal testing

The shop gets the app through the **Internal testing** track (up to 100 testers, no review
wait, no public listing). Console coordinates, confirmed 25 Aug 2026:

- App: `com.flexachem.workshop`, developer account `8700928663978881220`, app id
  `4973573654801583013`, internal-testing track id `4701102818064680699`.
- **Tester opt-in link:** `https://play.google.com/apps/internaltest/4701102818064680699`
  Testers must accept it with the Google account signed in on the phone.

**The signing situation, which is NOT what the earlier plan assumed.** Play App Signing was
enabled when the app was first uploaded on 12 Aug 2026, and Play generated **its own** app
signing key:

| Key | Fingerprint | What it does |
| --- | --- | --- |
| App signing (Play's) | `BA:70:E4:9E:49:C6...CD:79:93` | Signs what Play actually distributes |
| Upload (`flexachem.keystore`) | `95:15:0B:C3...C0:FD` | What Play checks when you upload |

Read the app signing fingerprint off the **Digital Asset Links JSON** at the bottom of the
App signing page - the buttons at the top only copy to the clipboard, and the value is not in
the DOM. Digital Asset Links always quotes the app signing key.

Consequences worth keeping:

- **A Play build and `apk/release/Flexachem.apk` are NOT interchangeable.** Neither upgrades
  over the other. The sideloaded APK is a separate, mutually exclusive path, not a fallback
  for a phone that installed from Play.
- **`flexachem.keystore` is still essential** - without it you cannot upload a release at all.
  Back it up off this machine.
- That choice is effectively permanent; changing it means "Change key", which is disruptive.

Steps for a new internal-testing release: Testing -> Internal testing -> Create new release ->
upload the AAB -> release notes (**500 character limit per language**, including the
`<en-US>` tags) -> Save and publish. **Check the track is not paused** - a published release
on a paused track reaches nobody, and the paused banner is easy to miss.

Privacy policy URL (required, already public and unauthenticated):
`https://flexachem-workshop-tracker.vercel.app/privacy`

4. Store listing and screenshots do not block an internal-testing rollout.

**A debug APK cannot be upgraded to a release APK** — different signing keys, so Android
refuses. Moving a phone off a debug build needs an uninstall first, which clears the WebView's
localStorage: the user is signed out and their theme resets. Job data is in Supabase and is
unaffected. Warn people before, and do not uninstall anything until the Play release is live
and verified.

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

**7. Enable push in the build** (do this LAST — only after steps 1–3)
- Add `VITE_ENABLE_PUSH=true` to `.env.local`, then rebuild (`npm run apk`).
- Push registration is **off by default**. This is deliberate: calling `register()`
  before `google-services.json` exists throws a native Firebase exception that crashes the
  app right after the user taps "Allow" on the notification prompt. Do NOT set this flag
  until `google-services.json` and the google-services Gradle plugin (step 3) are in place.

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
