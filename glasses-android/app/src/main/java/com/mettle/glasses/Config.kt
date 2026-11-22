package com.mettle.glasses

/** Everything you're likely to want to change, in one place. */
object Config {
    /** Port for the Wi-Fi control server: http://<glasses-ip>:8080/open */
    const val HTTP_PORT = 8080

    /** Open the viewer automatically ~20s after the glasses boot. Off: it just starts listening. */
    const val OPEN_ON_BOOT = true

    const val TAG = "MettleWhisper"
}
