# Mettle Whisper — M6 viewer APK

docs/WORN_M6.md, rungs 4–5. A minimal Android app that renders whisper-tier
cards mono-green on black — the same card the `/glasses` web preview shows.
**The glasses are the Android device** (Android 9, Unisoc W527, 2GB): no
phone, no broadcast, just same-WiFi.

Merged with the Worn `GlassesAppTemplate` (Nov 22): sideloaded apps don't
appear in the glasses' menu and can't start at boot, so the app now carries
the template's persistence layer — an accessibility service Android
restarts at every boot, a foreground keep-alive, and an on-glasses HTTP
control server.

## Cards: two paths

- **Push (preferred)** — the glasses run an HTTP server on :8080. The
  relay POSTs each card straight to it; the viewer pops up over the menu
  if it isn't on screen:
  ```bash
  python3 scripts/glasses_relay.py http://<mac-ip>:3000 \
    --sink http=http://<glasses-ip>:8080/card
  ```
- **Poll (fallback)** — the app GETs `<relay>/api/glasses` every 300 ms;
  unreachable relay holds the current card. Set the relay once:
  ```bash
  curl "http://<glasses-ip>:8080/relay?url=http://<mac-ip>:3000"
  # or over adb:
  adb shell am start -n com.mettle.glasses/.MainActivity \
    --es relay http://<mac-ip>:3000
  ```

`kind=phase` → letterspaced stamp; `proactive`/`reactive` → headline
(+ body for reactive). Auto-clears on `ttl_ms`.

## Wi-Fi control (ControlServer, port 8080)

```bash
curl http://<glasses-ip>:8080/open     # bring the viewer to the front
curl http://<glasses-ip>:8080/close    # back to the menu
curl http://<glasses-ip>:8080/ping     # is it running, is it on screen?
curl -X POST http://<glasses-ip>:8080/card \
  -H 'Content-Type: application/json' \
  -d '{"kind":"proactive","headline":"hold your number","ttl_ms":8000}'
curl "http://<glasses-ip>:8080/relay?url=http://<mac-ip>:3000"
```

Anyone on the same network can send these. Venue Wi-Fi often blocks
device-to-device traffic; a phone hotspot avoids that.

## Set up (once per pair of glasses)

1. In MLDemo, connect the glasses and turn on **Developer Mode** (Glasses
   screen › Developer). Replug the glasses' USB cable into your Mac and
   check that `adb devices` lists them.
2. From this folder, run:
   ```bash
   ./setup.sh
   ```
   It builds and installs the app, turns on its accessibility service
   (that's what restarts it at every boot), exempts it from doze, and
   opens it. The first build downloads Gradle and the Android build
   tools, which takes a few minutes.
3. Unplug the glasses. The app now starts itself ~20 s after every
   power-on (`Config.OPEN_ON_BOOT`) and answers :8080 without a cable.

Later updates can go through Android Studio's **Run**, or rebuild +
`adb install -r`. You only need `setup.sh` again on new glasses, or if
you rename the app. To take it off: `./remove.sh`.

## Build

Requires JDK 17 and an Android SDK (platform android-34, build-tools).
The repo includes the wrapper — `./gradlew` downloads Gradle itself:

```bash
cd glasses-android
./gradlew assembleDebug  # → app/build/outputs/apk/debug/app-debug.apk
```

No-Android-Studio setup used on the dev Mac (no sudo needed):

```bash
# JDK 17 → ~/tools/jdk-17 (Temurin tarball, api.adoptium.net)
# cmdline-tools → ~/tools/android-sdk/cmdline-tools/latest (dl.google.com)
export JAVA_HOME=~/tools/jdk-17/Contents/Home
export ANDROID_HOME=~/tools/android-sdk
sdkmanager "platforms;android-34" "build-tools;34.0.0" "platform-tools"
```

`setup.sh` prefers Android Studio's bundled JDK (`/Applications/Android
Studio.app/...`) and `~/Library/Android/sdk` when present; override with
`JAVA_HOME`/`ANDROID_HOME`.

## Behaviour / hardware notes

- **Display:** 640×480. Black pixels are see-through — the layout is
  black with bright mono-green text (matches `/glasses` preview).
- **Touchpad** (`onKeyDown`): swipes → `DPAD_LEFT`/`DPAD_RIGHT`, tap →
  `ENTER`, double-tap → `F12` (handled: back to the menu).
- **Logs:** `adb logcat -s MettleWhisper`.
- Perms: `INTERNET` + `WAKE_LOCK` + `FOREGROUND_SERVICE` only — no
  camera/mic.
- Sideloaded-app persistence is via the accessibility-service restart
  trick from the Worn template — `OpenService` starts `KeepAliveService`
  at every boot; the service runs `ControlServer` and optionally opens
  the viewer.

## Status

Compiles clean (`assembleDebug`, Nov 21, JDK 17 + AGP 8.5.2 → ~2.3 MB
APK). Untested on hardware: first boot, poll loop, and waveguide scaling
remain venue unknowns — the template's boot/control paths are tested by
the Worn team on M6, ours reuses them unchanged.
