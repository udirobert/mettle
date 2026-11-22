#!/usr/bin/env bash
# One-time setup for a glasses app built from this template.
# Builds and installs the app, turns on its background service, and opens it.
# Needs the glasses plugged in over USB with Developer Mode on (MLDemo › Glasses › Developer).
# After this, the app starts itself at every boot. Later updates can go through Android Studio's Run button.
set -euo pipefail
cd "$(dirname "$0")"

# Tools: Android Studio's SDK and its bundled JDK.
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
STUDIO_JDK="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ -z "${JAVA_HOME:-}" ] && [ -d "$STUDIO_JDK" ]; then export JAVA_HOME="$STUDIO_JDK"; fi
ADB="$(command -v adb || echo "$ANDROID_HOME/platform-tools/adb")"

APP_ID=$(sed -nE 's/^[[:space:]]*applicationId[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' app/build.gradle.kts)
NAMESPACE=$(sed -nE 's/^[[:space:]]*namespace[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' app/build.gradle.kts)
SERVICE="$APP_ID/$NAMESPACE.OpenService"

if ! "$ADB" get-state >/dev/null 2>&1; then
  echo "No glasses found. Plug them in, turn on Developer Mode in MLDemo, replug, and check 'adb devices'." >&2
  exit 1
fi

echo "1/4 Building and installing $APP_ID..."
./gradlew -q installDebug

echo "2/4 Turning on the background service..."
CURRENT=$("$ADB" shell settings get secure enabled_accessibility_services | tr -d '\r')
if [ -z "$CURRENT" ] || [ "$CURRENT" = "null" ]; then
  NEW="$SERVICE"
elif [[ ":$CURRENT:" == *":$SERVICE:"* ]]; then
  NEW="$CURRENT"
else
  NEW="$CURRENT:$SERVICE"   # keep any services that were already on
fi
"$ADB" shell settings put secure enabled_accessibility_services "$NEW"
"$ADB" shell settings put secure accessibility_enabled 1

echo "3/4 Exempting it from battery-saving sleep..."
"$ADB" shell dumpsys deviceidle whitelist "+$APP_ID" >/dev/null

echo "4/4 Opening the app..."
"$ADB" shell am start -n "$APP_ID/$NAMESPACE.MainActivity" --es reason setup >/dev/null

IP=$("$ADB" shell ip -f inet addr show wlan0 2>/dev/null | sed -nE 's/.*inet ([0-9.]+).*/\1/p' | head -1 || true)
echo
echo "Done. You can unplug the glasses."
if [ -n "$IP" ]; then
  echo "  Open over Wi-Fi: curl http://$IP:8080/open"
else
  echo "  Open over Wi-Fi: join the glasses to Wi-Fi (MLDemo > Wi-Fi), then curl http://<glasses-ip>:8080/open"
fi
echo "  Logs:            adb logcat -s MettleWhisper"
