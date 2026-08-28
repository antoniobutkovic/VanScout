package com.strive.vanscout.network

import io.ktor.client.call.body
import io.ktor.client.plugins.ClientRequestException
import io.ktor.client.plugins.ServerResponseException
import io.ktor.client.statement.HttpResponse
import io.ktor.http.isSuccess

internal suspend inline fun <reified T> safeResponse(crossinline block: suspend () -> HttpResponse): Response<T> = try {
    val response = block()
    if (response.status.isSuccess()) {
        Response.Success(response.body())
    } else {
        Response.HttpError(response.status.value)
    }
} catch (e: ClientRequestException) {
    Response.HttpError(e.response.status.value)
} catch (e: ServerResponseException) {
    Response.HttpError(e.response.status.value)
} catch (e: Exception) {
    Response.Error(e)
}

sealed interface Response<out T> {
    class Success<T>(val data: T) : Response<T>

    class Error(val e: Exception) : Response<Nothing>

    class HttpError(val statusCode: Int) : Response<Nothing>
}

internal suspend inline fun <T> Response<T>.onError(crossinline block: suspend (e: Exception) -> Unit): Response<T> = apply {
    if (this is Response.Error) {
        block(e)
    }
}

internal suspend inline fun <T> Response<T>.onHttpError(crossinline block: suspend (code: Int) -> Unit): Response<T> = apply {
    if (this is Response.HttpError) {
        block(statusCode)
    }
}

internal fun <T> Response<T>.isSuccess(): Boolean = this is Response.Success

internal inline fun <T> Response<T>.getDataOrElse(defaultValue: () -> T): T = if (this is Response.Success) {
    data
} else {
    defaultValue.invoke()
}

internal fun <T> Response<T>.getDataOrNull(): T? = if (this is Response.Success) {
    data
} else {
    null
}
