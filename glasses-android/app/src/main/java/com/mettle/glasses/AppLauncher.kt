package com.mettle.glasses

import android.content.Context
import android.content.Intent
import android.util.Log

/** Opens or closes the app's screen. Works from the background on Android 9. */
object AppLauncher {

    fun open(context: Context, reason: String) {
        Log.i(Config.TAG, "Opening app ($reason)")
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .putExtra(MainActivity.EXTRA_REASON, reason)
        context.startActivity(intent)
    }

    fun close() {
        val activity = MainActivity.current?.get() ?: return
        Log.i(Config.TAG, "Closing app")
        activity.runOnUiThread { activity.finish() }
    }
}
