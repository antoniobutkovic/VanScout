package com.strive.movago.requirements

expect object Logger {
    fun logV(message: String)

    fun logI(message: String)

    fun logD(message: String)

    fun logW(
        message: String,
        throwable: Throwable? = null
    )

    fun logE(
        message: String,
        throwable: Throwable? = null
    )
}
