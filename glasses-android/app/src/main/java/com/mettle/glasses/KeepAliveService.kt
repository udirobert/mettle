package com.mettle.glasses

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * A foreground service, so Android keeps the app running in the background.
 * It also runs the Wi-Fi control server: open/close the viewer, push cards,
 * repoint the relay — all over the same Wi-Fi, no cable.
 */
class KeepAliveService : Service() {

    private var server: ControlServer? = null

    override fun onCreate() {
        super.onCreate()
        val channel = NotificationChannel("keepalive", "Background", NotificationManager.IMPORTANCE_MIN)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        val notification = Notification.Builder(this, "keepalive")
            .setContentTitle(getString(R.string.app_name))
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .build()
        startForeground(1, notification)

        server = ControlServer(applicationContext, Config.HTTP_PORT).also { it.start() }
        Log.i(Config.TAG, "KeepAliveService started")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int) = START_STICKY

    override fun onDestroy() {
        server?.shutdown()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
