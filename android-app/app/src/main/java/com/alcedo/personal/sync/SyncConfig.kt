package com.alcedo.personal.sync

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.MutablePreferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.syncDataStore by preferencesDataStore(name = "sync_settings")

object SyncConfig {
    private val serverUrlKey = stringPreferencesKey("server_url")
    private val apiKeyKey = stringPreferencesKey("api_key")

    fun getServerUrl(context: Context): String = runBlocking {
        context.syncDataStore.data.first()[serverUrlKey] ?: "http://10.0.2.2:8787"
    }

    fun getApiKey(context: Context): String = runBlocking {
        context.syncDataStore.data.first()[apiKeyKey] ?: "dev-local-key"
    }

    suspend fun save(context: Context, serverUrl: String, apiKey: String) {
        context.syncDataStore.edit { prefs: MutablePreferences ->
            prefs[serverUrlKey] = serverUrl
            prefs[apiKeyKey] = apiKey
        }
    }
}
