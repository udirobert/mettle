# Mettle Whisper — M6 viewer APK

docs/WORN_M6.md, rungs 4–5. A minimal Android app that polls the relay
(`/api/glasses`) and renders whisper-tier cards mono-green on black —
the same card the `/glasses` web preview shows. **The glasses are the
Android device** (Android 9, Unisoc W527, 2GB): no phone, no broadcast,
just same-WiFi polling.

## Status

**Compiles clean** — `assembleDebug` verified Nov 21 on the dev Mac
(JDK 17 + AGP 8.5.2 → `app-debug.apk`, ~2.3 MB). Still untested on
hardware: first boot on the M6 is the remaining unknown (poll loop,
layout scaling on the waveguide).

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

## Deploy to the M6

```bash
# USB-C, or WiFi adb if enabled on the glasses
adb install -r app/build/outputs/apk/debug/app-debug.apk

# Point it at the relay once — persisted afterwards
adb shell am start -n com.mettle.glasses/.MainActivity \
  --es relay http://<mac-ip>:3000
```

The Mac's LAN URL is what `next dev` prints as "Network:" (e.g.
`http://172.29.1.95:3000`). Glasses and Mac on the same WiFi — that's the
whole transport.

## Behaviour

- Polls every 300 ms; unreachable relay holds the current card.
- `kind=phase` → letterspaced stamp; `proactive`/`reactive` → headline
  (+ body for reactive). Auto-clears on `ttl_ms`.
- `INTERNET` + `WAKE_LOCK` only — no camera/mic perms asked.
