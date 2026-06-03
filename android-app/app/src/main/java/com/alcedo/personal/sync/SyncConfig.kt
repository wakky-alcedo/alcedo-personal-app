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
    private val serverUrlKey = stringPreferencesKey("server_url")
    private val apiKeyKey    = stringPreferencesKey("api_key")

    fun getServerUrl(context: Context): String = runBlocking {
        val stored = context.syncDataStore.data.first()[serverUrlKey] ?: "http://10.0.2.2:8787"
        // Android の localhost は端末自身を指すため、PC の 10.0.2.2 に自動変換
        stored.replace("localhost", "10.0.2.2")
    }

    fun getApiKey(context: Context): String = runBlocking {
        context.syncDataStore.data.first()[apiKeyKey] ?: "dev-local-key"
    }

    suspend fun save(context: Context, serverUrl: String, apiKey: String) {
        context.syncDataStore.edit { prefs: MutablePreferences ->
            prefs[serverUrlKey] = serverUrl
            prefs[apiKeyKey]    = apiKey
        }
    }
}
