package com.alcedo.personal.notifications

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.notificationDataStore by preferencesDataStore(name = "notification_settings")

/** タスク期限通知の設定（通知ON/OFF・アラーム音ON/OFF・通知タイミング・通知済みキー）を保持する */
object NotificationPrefs {
    const val DEFAULT_REMINDER_MINUTES = 30

    private val notificationsEnabledKey = booleanPreferencesKey("notifications_enabled")
    private val alarmEnabledKey = booleanPreferencesKey("alarm_enabled")
    private val reminderMinutesKey = intPreferencesKey("reminder_minutes")
    private val notifiedKeysKey = stringSetPreferencesKey("notified_keys")

    fun notificationsEnabled(context: Context): Flow<Boolean> =
        context.notificationDataStore.data.map { it[notificationsEnabledKey] ?: false }

    fun alarmEnabled(context: Context): Flow<Boolean> =
        context.notificationDataStore.data.map { it[alarmEnabledKey] ?: false }

    fun reminderMinutes(context: Context): Flow<Int> =
        context.notificationDataStore.data.map { it[reminderMinutesKey] ?: DEFAULT_REMINDER_MINUTES }

    suspend fun isNotificationsEnabled(context: Context): Boolean =
        context.notificationDataStore.data.first()[notificationsEnabledKey] ?: false

    suspend fun isAlarmEnabled(context: Context): Boolean =
        context.notificationDataStore.data.first()[alarmEnabledKey] ?: false

    suspend fun getReminderMinutes(context: Context): Int =
        context.notificationDataStore.data.first()[reminderMinutesKey] ?: DEFAULT_REMINDER_MINUTES

    suspend fun getNotifiedKeys(context: Context): Set<String> =
        context.notificationDataStore.data.first()[notifiedKeysKey] ?: emptySet()

    suspend fun setNotificationsEnabled(context: Context, value: Boolean) {
        context.notificationDataStore.edit { it[notificationsEnabledKey] = value }
    }

    suspend fun setAlarmEnabled(context: Context, value: Boolean) {
        context.notificationDataStore.edit { it[alarmEnabledKey] = value }
    }

    suspend fun setReminderMinutes(context: Context, value: Int) {
        context.notificationDataStore.edit { it[reminderMinutesKey] = value.coerceAtLeast(1) }
    }

    suspend fun setNotifiedKeys(context: Context, keys: Set<String>) {
        context.notificationDataStore.edit { it[notifiedKeysKey] = keys }
    }
}
