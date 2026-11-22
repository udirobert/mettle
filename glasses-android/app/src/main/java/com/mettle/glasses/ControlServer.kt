package com.mettle.glasses

import android.content.Context
import android.util.Log
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket

/**
 * A tiny HTTP server so a phone or laptop on the same Wi-Fi can control the app:
 *
 *   curl http://<glasses-ip>:8080/open
 *   curl http://<glasses-ip>:8080/close
 *   curl http://<glasses-ip>:8080/ping
 *   curl -X POST http://<glasses-ip>:8080/card \
 *     -d '{"kind":"proactive","headline":"hold your number","ttl_ms":8000}'
 *   curl "http://<glasses-ip>:8080/relay?url=http://<mac-ip>:3000"
 *
 * Anyone on the same network can reach it. /card is the push path for
 * glasses_relay.py --sink http=…:8080/card — the poll loop in MainActivity
 * stays as the fallback when nothing pushes.
 */
class ControlServer(private val context: Context, private val port: Int) : Thread("ControlServer") {

    @Volatile private var serverSocket: ServerSocket? = null

    override fun run() {
        try {
            val server = ServerSocket().apply {
                reuseAddress = true
                bind(InetSocketAddress(port))
            }
            serverSocket = server
            Log.i(Config.TAG, "Control server listening on port $port")
            while (!isInterrupted) {
                server.accept().use { handle(it) }
            }
        } catch (e: IOException) {
            Log.i(Config.TAG, "Control server stopped: ${e.message}")
        }
    }

    private fun route(method: String, path: String, query: String, body: String): Pair<Int, String> =
        when {
            method == "GET" && path == "/open" -> {
                AppLauncher.open(context, "wifi")
                200 to """{"ok":true}"""
            }
            method == "GET" && path == "/close" -> {
                AppLauncher.close()
                200 to """{"ok":true}"""
            }
            method == "POST" && path == "/card" -> {
                try {
                    val card = JSONObject(body)
                    if (MainActivity.isVisible) {
                        MainActivity.current?.get()?.showCardJson(card)
                    } else {
                        MainActivity.pendingCard = card
                        AppLauncher.open(context, "card")
                    }
                    200 to """{"ok":true}"""
                } catch (e: Exception) {
                    400 to """{"ok":false,"error":"bad card json"}"""
                }
            }
            method == "GET" && path == "/relay" -> {
                val url = queryParam(query, "url")
                if (url == null) {
                    400 to """{"ok":false,"error":"missing url param"}"""
                } else {
                    MainActivity.configureRelay(context, url)
                    200 to """{"ok":true,"relay":"$url"}"""
                }
            }
            method == "GET" && (path == "/" || path == "/ping") ->
                200 to """{"ok":true,"app":"${context.packageName}","visible":${MainActivity.isVisible}}"""
            else -> 404 to """{"ok":false,"error":"unknown path"}"""
        }

    private fun queryParam(query: String, name: String): String? =
        query.split('&').firstNotNullOfOrNull { pair ->
            val (k, v) = pair.split('=', limit = 2).let {
                it[0] to it.getOrElse(1) { "" }
            }
            if (k == name) v else null
        }

    private fun handle(client: Socket) {
        try {
            client.soTimeout = 5000
            val input = client.getInputStream()

            // Read headers byte-wise until \r\n\r\n so the body isn't consumed early.
            val head = ByteArrayOutputStream()
            var match = 0
            while (match < 4 && head.size() < 16 * 1024) {
                val b = input.read()
                if (b < 0) return
                head.write(b)
                match = when {
                    b == CRLF[match].toInt() -> match + 1
                    b == '\r'.code -> 1
                    else -> 0
                }
            }
            val lines = head.toString().split("\r\n")
            val parts = lines[0].split(" ")
            val method = parts.getOrNull(0) ?: "GET"
            val target = parts.getOrNull(1) ?: "/"
            val path = target.substringBefore('?')
            val query = target.substringAfter('?', "")
            val contentLength = lines.firstOrNull {
                it.startsWith("Content-Length:", ignoreCase = true)
            }?.substringAfter(':')?.trim()?.toIntOrNull() ?: 0

            val body = if (method == "POST" && contentLength in 1..64 * 1024) {
                val buf = ByteArray(contentLength)
                var read = 0
                while (read < contentLength) {
                    val n = input.read(buf, read, contentLength - read)
                    if (n < 0) break
                    read += n
                }
                String(buf, 0, read)
            } else ""

            val (status, respBody) = route(method, path, query, body)
            val bytes = respBody.toByteArray()
            val reason = when (status) {
                200 -> "OK"; 400 -> "Bad Request"; else -> "Not Found"
            }
            val header = "HTTP/1.1 $status $reason\r\n" +
                "Content-Type: application/json\r\n" +
                "Content-Length: ${bytes.size}\r\n" +
                "Access-Control-Allow-Origin: *\r\n" +
                "Connection: close\r\n\r\n"
            client.getOutputStream().apply {
                write(header.toByteArray())
                write(bytes)
                flush()
            }
        } catch (e: IOException) {
            Log.w(Config.TAG, "Control request failed: ${e.message}")
        }
    }

    fun shutdown() {
        interrupt()
        serverSocket?.close()
    }

    companion object {
        private val CRLF = byteArrayOf(13, 10, 13, 10)
    }
}
