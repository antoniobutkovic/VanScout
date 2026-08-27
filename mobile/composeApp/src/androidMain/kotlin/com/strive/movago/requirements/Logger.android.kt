package com.strive.movago.requirements

import timber.log.Timber

actual object Logger {
    init {
        Timber.plant(Timber.DebugTree())
    }

    actual fun logV(message: String) {
        Timber.v(message)
    }

    actual fun logI(message: String) {
        Timber.i(message)
    }

    actual fun logD(message: String) {
        Timber.d(message)
    }

    actual fun logW(
        message: String,
        throwable: Throwable?
    ) {
        Timber.w(throwable, message)
    }

    actual fun logE(
        message: String,
        throwable: Throwable?
    ) {
        Timber.e(throwable, message)
    }
}
