package com.alcedo.personal.sync

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.memoSyncDataStore by preferencesDataStore(name = "memo_sync_state")

/**
 * Where the last memo pull stopped. The cursor is tied to the server it came from, so
 * switching servers starts a full pull instead of skipping the new server's older memos.
 */
object MemoSyncState {
    private val cursorKey = stringPreferencesKey("pull_cursor")
    private val serverKey = stringPreferencesKey("pull_cursor_server")

    /** Null means "pull everything" (first sync, or a different server). */
    suspend fun getCursor(context: Context, serverUrl: String): String? {
        val prefs = context.memoSyncDataStore.data.first()
        return prefs[cursorKey]?.takeIf { prefs[serverKey] == serverUrl }
    }

    suspend fun saveCursor(context: Context, serverUrl: String, cursor: String) {
        context.memoSyncDataStore.edit {
            it[cursorKey] = cursor
            it[serverKey] = serverUrl
        }
    }
}
