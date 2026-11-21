# Mettle Whisper — M6 viewer APK

docs/WORN_M6.md, rungs 4–5. A minimal Android app that polls the relay
(`/api/glasses`) and renders whisper-tier cards mono-green on black —
the same card the `/glasses` web preview shows. **The glasses are the
Android device** (Android 9, Unisoc W527, 2GB): no phone, no broadcast,
just same-WiFi polling.

## Status

**Untested scaffold** — written against standard Android APIs only
(`org.json`, `HttpURLConnection`, `TextView`); no SDK installed on the dev
machine to compile-verify. First build may need trivial fixes. Do the
first `./gradlew assembleDebug` *before* the venue if possible, or lean on
MicroLumin's engineer at the venue.

## Build

Requires Android SDK + Gradle 8.x (no wrapper jar committed — copy a
`gradle-wrapper.jar` in or use system gradle):

```bash
cd glasses-android
gradle wrapper           # generates the wrapper once
./gradlew assembleDebug  # → app/build/outputs/apk/debug/app-debug.apk
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
