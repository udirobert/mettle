#!/usr/bin/env bash
# Uninstalls the app and turns its background service off.
set -euo pipefail
cd "$(dirname "$0")"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$(command -v adb || echo "$ANDROID_HOME/platform-tools/adb")"
APP_ID=$(sed -nE 's/^[[:space:]]*applicationId[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' app/build.gradle.kts)
NAMESPACE=$(sed -nE 's/^[[:space:]]*namespace[[:space:]]*=[[:space:]]*"([^"]+)".*/\1/p' app/build.gradle.kts)
SERVICE="$APP_ID/$NAMESPACE.OpenService"

CURRENT=$("$ADB" shell settings get secure enabled_accessibility_services | tr -d '\r')
REST=$(echo "$CURRENT" | tr ':' '\n' | grep -vxF "$SERVICE" | grep -vx null | paste -sd: - || true)
if [ -z "$REST" ]; then
  "$ADB" shell settings delete secure enabled_accessibility_services >/dev/null
else
  "$ADB" shell settings put secure enabled_accessibility_services "$REST"
fi
"$ADB" shell dumpsys deviceidle whitelist "-$APP_ID" >/dev/null || true
"$ADB" uninstall "$APP_ID" || true
echo "Removed $APP_ID."
