package com.alcedo.personal.sync

import android.content.Context
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.syncDataStore by preferencesDataStore(name = "sync_settings")

object SyncConfig {
    private const val DEFAULT_SERVER_URL = "http://10.0.2.2:8787"

    private val serverUrlKey = stringPreferencesKey("server_url")
    private val apiKeyKey    = stringPreferencesKey("api_key")

    fun getServerUrl(context: Context): String = runBlocking {
        val stored = context.syncDataStore.data.first()[serverUrlKey] ?: DEFAULT_SERVER_URL
        // Android の localhost は端末自身を指すため、PC の 10.0.2.2 に自動変換
        stored.replace("localhost", "10.0.2.2")
    }

    /** Empty when the user has not set one. There is no default key: the server rejects it anyway. */
    fun getApiKey(context: Context): String = runBlocking {
        context.syncDataStore.data.first()[apiKeyKey] ?: ""
    }

    fun isConfigured(context: Context): Boolean =
        getServerUrl(context).isNotBlank() && getApiKey(context).isNotBlank()

    /** Null while the server URL or API key is unset; callers skip syncing in that case. */
    fun httpClient(context: Context): ApiHttpClient? {
        val url = getServerUrl(context).takeIf { it.isNotBlank() } ?: return null
        val key = getApiKey(context).takeIf { it.isNotBlank() } ?: return null
        return ApiHttpClient(url, key)
    }

    suspend fun save(context: Context, serverUrl: String, apiKey: String) {
        context.syncDataStore.edit { prefs: MutablePreferences ->
            prefs[serverUrlKey] = serverUrl
            prefs[apiKeyKey]    = apiKey
        }
    }
}
