package com.strive.vanscout.requirements

import platform.Foundation.NSDate
import platform.Foundation.NSDateFormatter
import platform.Foundation.NSThread
import platform.posix.printf

actual object Logger {
    private enum class LogLevel {
        VERBOSE,
        INFO,
        DEBUG,
        WARN,
        ERROR
    }

    private val dateFormatter = NSDateFormatter().apply { dateFormat = "yyyy-MM-dd HH:mm:ss.SSS" }

    actual fun logV(message: String) {
        log(LogLevel.VERBOSE, message)
    }

    actual fun logI(message: String) {
        log(LogLevel.INFO, message)
    }

    actual fun logD(message: String) {
        log(LogLevel.DEBUG, message)
    }

    actual fun logW(
        message: String,
        throwable: Throwable?
    ) {
        log(LogLevel.WARN, message, throwable)
    }

    actual fun logE(
        message: String,
        throwable: Throwable?
    ) {
        log(LogLevel.ERROR, message, throwable)
    }

    private fun log(
        logLevel: LogLevel,
        message: String,
        throwable: Throwable? = null
    ) {
        val time = dateFormatter.stringFromDate(NSDate())
        val thread = if (NSThread.currentThread.isMainThread) "MainThread" else "BackgroundThread"
        val logLine = "$time ${logLevel.prefix()} - $thread - $message\n"
        printf(logLine)
        if (throwable != null) {
            val throwableMessage = throwable.message ?: ""
            val stackTrace = throwable.stackTraceToString()
            if (throwableMessage.isNotBlank() && throwableMessage != message) {
                printf("$throwableMessage\n")
            }
            if (stackTrace.isNotBlank()) {
                printf("$stackTrace\n")
            }
        }
    }

    private fun LogLevel.prefix() = when (this) {
        LogLevel.VERBOSE -> "V"
        LogLevel.INFO -> "I"
        LogLevel.DEBUG -> "D"
        LogLevel.WARN -> "W"
        LogLevel.ERROR -> "️E"
    }
}
