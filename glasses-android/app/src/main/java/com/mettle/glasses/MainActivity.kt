package com.mettle.glasses

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL

/**
 * Mettle Whisper — M6 whisper-tier viewer (docs/WORN_M6.md, rungs 4-5).
 *
 * Two card paths:
 *  - poll: GETs the relay (/api/glasses) every 300 ms — works on its own.
 *  - push: ControlServer POST /card renders instantly and pops the viewer
 *    over the menu if it isn't up (glasses_relay --sink http=…:8080/card).
 *
 * Cards render mono-green on black — same visual language as frontend
 * /glasses; black pixels are see-through on the waveguide.
 *
 * Relay URL: launch extra once (persisted), or over Wi-Fi
 *   curl "http://<glasses-ip>:8080/relay?url=http://<mac-ip>:3000"
 *
 * Zero dependencies — org.json + HttpURLConnection only.
 */
class MainActivity : Activity() {

    companion object {
        const val EXTRA_REASON = "reason"
        private const val POLL_MS = 300L
        private const val GREEN = 0xFF4DFF7A.toInt()
        private const val PREFS = "mettle_whisper"
        private const val PREF_RELAY = "relay_url"

        @Volatile var isVisible = false
            private set
        @Volatile var current: WeakReference<MainActivity>? = null
            private set

        /** Card pushed while the viewer isn't on screen — rendered in onResume. */
        @Volatile var pendingCard: JSONObject? = null

        /** Repoint the relay over Wi-Fi (ControlServer /relay). */
        fun configureRelay(context: Context, url: String) {
            val base = url.trimEnd('/')
            context.getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString(PREF_RELAY, base).apply()
            Log.i(Config.TAG, "Relay set to $base")
            current?.get()?.apply {
                relayBase = base
                startPolling()
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var headline: TextView
    private lateinit var body: TextView
    @Volatile private var relayBase: String? = null
    private var lastCard: String? = null
    private var clearRunnable: Runnable? = null
    @Volatile private var polling = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        // Keep the background service running even if the app was started some other way.
        startForegroundService(Intent(this, KeepAliveService::class.java))

        headline = textView(26f).apply { gravity = Gravity.START }
        body = textView(18f).apply {
            gravity = Gravity.START
            alpha = 0.82f
        }

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.BLACK) // black is see-through on the waveguide
            setPadding(pct(8), pct(18), pct(8), 0)
            addView(headline)
            addView(body)
        }
        setContentView(col)

        handleRelayExtra()
        if (relayBase == null) {
            headline.text = "SET RELAY\n\ncurl \"http://<glasses-ip>:8080/relay?url=http://<mac-ip>:3000\"\n\nor push: POST /card"
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleRelayExtra()
    }

    override fun onResume() {
        super.onResume()
        isVisible = true
        current = WeakReference(this)
        pendingCard?.let {
            pendingCard = null
            showCard(it)
        }
    }

    override fun onPause() {
        isVisible = false
        super.onPause()
    }

    /** Touchpad: swipes are DPAD_LEFT / DPAD_RIGHT, a tap is ENTER, a double-tap is F12. */
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_F12) { // double-tap: back to the menu
            finish()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    /** Push path — ControlServer calls this with a card that arrived over Wi-Fi. */
    fun showCardJson(card: JSONObject) {
        handler.post { showCard(card) }
    }

    private fun handleRelayExtra() {
        intent?.getStringExtra("relay")?.let { url ->
            relayBase = url.trimEnd('/')
            getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putString(PREF_RELAY, relayBase).apply()
            startPolling()
        } ?: run {
            relayBase = getSharedPreferences(PREFS, MODE_PRIVATE)
                .getString(PREF_RELAY, null)
            if (relayBase != null) startPolling()
        }
    }

    private fun startPolling() {
        if (polling) return // the loop reads relayBase each tick — updates just work
        polling = true
        Thread({
            while (true) {
                try {
                    val conn = URL("$relayBase/api/glasses").openConnection() as HttpURLConnection
                    conn.connectTimeout = 1500
                    conn.readTimeout = 1500
                    val text = conn.inputStream.bufferedReader().readText()
                    conn.disconnect()
                    val payload = JSONObject(text)
                    val cardKey = payload.getJSONObject("card").toString()
                    if (cardKey != lastCard) {
                        lastCard = cardKey
                        handler.post { showCard(payload.getJSONObject("card")) }
                    }
                } catch (_: Exception) {
                    // relay unreachable — hold current card, retry
                }
                Thread.sleep(POLL_MS)
            }
        }, "whisper-poll").apply { isDaemon = true }.start()
    }

    private fun showCard(card: JSONObject) {
        val kind = card.optString("kind", "proactive")
        clearRunnable?.let { handler.removeCallbacks(it) }

        if (kind == "phase") {
            headline.text = card.optString("headline").toCharArray()
                .joinToString(" ") // letterspaced stamp
            body.visibility = View.GONE
        } else {
            headline.text = card.optString("headline")
            val b = card.optString("body")
            body.visibility = if (b.isNullOrEmpty()) View.GONE else View.VISIBLE
            body.text = b
        }

        val ttl = card.optLong("ttl_ms", 8000)
        val r = Runnable {
            headline.text = ""
            body.visibility = View.GONE
        }
        clearRunnable = r
        handler.postDelayed(r, ttl)
    }

    private fun textView(sizeSp: Float) = TextView(this).apply {
        setTextColor(GREEN)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        typeface = Typeface.MONOSPACE
        setShadowLayer(6f, 0f, 0f, GREEN)
    }

    private fun pct(percent: Int): Int =
        (resources.displayMetrics.widthPixels * percent / 100)
}
