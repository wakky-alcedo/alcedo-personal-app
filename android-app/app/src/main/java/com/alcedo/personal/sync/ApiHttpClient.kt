package com.alcedo.personal.sync

import java.net.HttpURLConnection
import java.net.URL

/** Connect/read timeouts for one request. Presets are in [HttpTimeouts]. */
data class HttpTimeout(val connectMs: Int, val readMs: Int)

object HttpTimeouts {
    /** Small JSON requests (CRUD, pushes). */
    val DEFAULT = HttpTimeout(connectMs = 5_000, readMs = 5_000)
    /** Pulls whose response can be large (task list, memo pages, activity logs). */
    val LONG_READ = HttpTimeout(connectMs = 5_000, readMs = 10_000)
    /** Bulk uploads of usage sessions. */
    val BULK_UPLOAD = HttpTimeout(connectMs = 10_000, readMs = 15_000)
}

/** Outcome of one HTTP call, so callers can tell server rejections from connectivity problems. */
sealed interface ApiResult {
    data class Success(val status: Int, val body: String) : ApiResult
    data class HttpError(val status: Int) : ApiResult
    data class NetworkError(val cause: Throwable) : ApiResult
}

/** How a queued change should be treated after trying to push it. */
enum class PushResult { OK, RETRYABLE, REJECTED }

/**
 * 400/404 mean the server will never accept the change (invalid, or the target was deleted),
 * so it should be dropped instead of retried forever. Auth/server/network errors stay RETRYABLE.
 */
fun ApiResult.toPushResult(): PushResult = when (this) {
    is ApiResult.Success -> PushResult.OK
    is ApiResult.HttpError -> if (status == 400 || status == 404) PushResult.REJECTED else PushResult.RETRYABLE
    is ApiResult.NetworkError -> PushResult.RETRYABLE
}

/**
 * Shared HttpURLConnection plumbing for the PC server API: timeouts, the X-Api-Key header,
 * JSON bodies (UTF-8) and disconnecting in `finally`.
 */
class ApiHttpClient(private val baseUrl: String, private val apiKey: String) {

    /** [path] starts with "/api/v1/..." and may carry an already-encoded query string. */
    fun get(path: String, timeout: HttpTimeout = HttpTimeouts.DEFAULT): ApiResult =
        execute("GET", path, null, timeout)

    fun post(path: String, json: String, timeout: HttpTimeout = HttpTimeouts.DEFAULT): ApiResult =
        execute("POST", path, json, timeout)

    /**
     * Android's HttpURLConnection adds `Content-Type: application/x-www-form-urlencoded` to a
     * bodiless DELETE, which Fastify rejects with 415 (no parser for that type; DELETE payloads
     * are parsed whenever a content type is given — fastify.dev/docs/latest/Reference/ContentTypeParser).
     * Sending an explicit empty JSON object keeps the request parseable.
     */
    fun delete(path: String, timeout: HttpTimeout = HttpTimeouts.DEFAULT): ApiResult =
        execute("DELETE", path, EMPTY_JSON_BODY, timeout)

    private companion object {
        const val EMPTY_JSON_BODY = "{}"
    }

    private fun execute(method: String, path: String, json: String?, timeout: HttpTimeout): ApiResult {
        val conn = try {
            URL("$baseUrl$path").openConnection() as HttpURLConnection
        } catch (e: Exception) {
            return ApiResult.NetworkError(e)
        }
        return try {
            conn.requestMethod = method
            conn.setRequestProperty("X-Api-Key", apiKey)
            conn.connectTimeout = timeout.connectMs
            conn.readTimeout = timeout.readMs
            if (json != null) {
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true
                conn.outputStream.bufferedWriter(Charsets.UTF_8).use { it.write(json) }
            }
            val status = conn.responseCode
            if (status in 200..299) {
                ApiResult.Success(status, conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() })
            } else {
                ApiResult.HttpError(status)
            }
        } catch (e: Exception) {
            ApiResult.NetworkError(e)
        } finally {
            conn.disconnect()
        }
    }
}
