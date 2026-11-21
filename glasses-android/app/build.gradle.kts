plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.mettle.glasses"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.mettle.glasses"
        minSdk = 28 // M6 runs Android 9 (API 28)
        targetSdk = 34
        versionCode = 1
        versionName = "0.1"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    jvmToolchain(17)
}
