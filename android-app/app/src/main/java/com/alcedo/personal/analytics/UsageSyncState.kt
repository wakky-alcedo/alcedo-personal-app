package com.alcedo.personal.analytics

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.usageSyncDataStore by preferencesDataStore(name = "usage_sync_state")

/**
 * End time of the latest usage session the server accepted. Tied to the server it was sent to,
 * so switching servers re-sends the whole query window.
 */
object UsageSyncState {
    private val cursorKey = longPreferencesKey("pushed_end_ms")
    private val serverKey = stringPreferencesKey("pushed_server")

    suspend fun getCursor(context: Context, serverUrl: String): Long? {
        val prefs = context.usageSyncDataStore.data.first()
        return prefs[cursorKey]?.takeIf { prefs[serverKey] == serverUrl }
    }

    suspend fun saveCursor(context: Context, serverUrl: String, cursorEndMs: Long) {
        context.usageSyncDataStore.edit {
            it[cursorKey] = cursorEndMs
            it[serverKey] = serverUrl
        }
    }
}
