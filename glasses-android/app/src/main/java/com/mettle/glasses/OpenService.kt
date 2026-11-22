package com.mettle.glasses

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.SystemClock
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * The piece that makes the app persistent.
 *
 * The glasses' power manager won't let sideloaded apps start at boot, and the launcher won't list
 * them. But once an accessibility service is turned on (setup.sh does it once over adb), Android
 * itself reconnects it after every boot. This one just starts [KeepAliveService].
 */
class OpenService : AccessibilityService() {

    override fun onServiceConnected() {
        Log.i(Config.TAG, "OpenService connected")
        startForegroundService(Intent(this, KeepAliveService::class.java))

        val justBooted = SystemClock.elapsedRealtime() < 5 * 60_000
        if (Config.OPEN_ON_BOOT && justBooted) AppLauncher.open(this, "boot")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent) {}

    override fun onInterrupt() {}
}
