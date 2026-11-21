package com.mettle.glasses

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Mettle Whisper — M6 whisper-tier viewer (docs/WORN_M6.md, rungs 4-5).
 *
 * Polls the relay (/api/glasses) and renders the current card mono-green
 * on black — same visual language as frontend /glasses. One card at a
 * time; phase cards get the letterspaced stamp; cards auto-clear on ttl.
 *
 * Relay URL is set once via launch extra and persisted:
 *   adb shell am start -n com.mettle.glasses/.MainActivity \
 *     --es relay http://<mac-ip>:3000
 *
 * Zero dependencies — org.json + HttpURLConnection only.
 */
class MainActivity : Activity() {

    companion object {
        private const val POLL_MS = 300L
        private const val GREEN = 0xFF4DFF7A.toInt()
        private const val PREFS = "mettle_whisper"
        private const val PREF_RELAY = "relay_url"
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var headline: TextView
    private lateinit var body: TextView
    private var relayBase: String? = null
    private var lastCard: String? = null
    private var clearRunnable: Runnable? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        headline = textView(26f).apply { gravity = Gravity.START }
        body = textView(18f).apply {
            gravity = Gravity.START
            alpha = 0.82f
        }

        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            setPadding(pct(8), pct(18), pct(8), 0)
            addView(headline)
            addView(body)
        }
        setContentView(col)

        handleRelayExtra()
        if (relayBase == null) {
            headline.text = "SET RELAY\n\nadb shell am start -n com.mettle.glasses/.MainActivity --es relay http://<mac-ip>:3000"
        }
    }

    override fun onNewIntent(intent: android.content.Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleRelayExtra()
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
