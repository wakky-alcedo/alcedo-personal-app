import React, { createContext, useContext, useState } from 'react'

const LS_ENABLED_KEY = 'alcedo_notif_enabled'
const LS_REMINDER_MINUTES_KEY = 'alcedo_notif_reminder_minutes'
const DEFAULT_REMINDER_MINUTES = 30

type NotificationSettings = {
  enabled: boolean
  reminderMinutes: number
  permission: NotificationPermission | 'unsupported'
  setEnabled: (value: boolean) => void
  setReminderMinutes: (value: number) => void
  requestPermission: () => Promise<void>
}

const NotificationSettingsContext = createContext<NotificationSettings>({
  enabled: false,
  reminderMinutes: DEFAULT_REMINDER_MINUTES,
  permission: 'unsupported',
  setEnabled: () => {},
  setReminderMinutes: () => {},
  requestPermission: async () => {},
})

function readPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

export function NotificationSettingsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(
    () => localStorage.getItem(LS_ENABLED_KEY) === 'true'
  )
  const [reminderMinutes, setReminderMinutesState] = useState(() => {
    const stored = Number(localStorage.getItem(LS_REMINDER_MINUTES_KEY))
    return stored > 0 ? stored : DEFAULT_REMINDER_MINUTES
  })
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(readPermission)

  function setEnabled(value: boolean) {
    setEnabledState(value)
    localStorage.setItem(LS_ENABLED_KEY, String(value))
  }

  function setReminderMinutes(value: number) {
    setReminderMinutesState(value)
    localStorage.setItem(LS_REMINDER_MINUTES_KEY, String(value))
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  return (
    <NotificationSettingsContext.Provider
      value={{ enabled, reminderMinutes, permission, setEnabled, setReminderMinutes, requestPermission }}
    >
      {children}
    </NotificationSettingsContext.Provider>
  )
}

export function useNotificationSettings(): NotificationSettings {
  return useContext(NotificationSettingsContext)
}
