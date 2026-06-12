import { useEffect, useRef } from 'react'
import type { Task } from '../api.ts'
import { useToast } from '../contexts/ToastContext.tsx'
import { useNotificationSettings } from '../contexts/NotificationSettingsContext.tsx'
import { buildNotifiedKey, pruneNotifiedKeys, selectTasksToNotify } from '../utils/dueTaskNotifications.ts'

const LS_NOTIFIED_KEYS = 'alcedo_notif_notified_keys'
const CHECK_INTERVAL_MS = 60_000

function loadNotifiedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_NOTIFIED_KEYS)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch {
    return new Set()
  }
}

function saveNotifiedKeys(keys: Set<string>) {
  localStorage.setItem(LS_NOTIFIED_KEYS, JSON.stringify([...keys]))
}

/** タスク期限通知: 有効な場合、期限が近いタスクを定期チェックしてブラウザ通知/アプリ内通知を出す */
export function useDueTaskNotifications(tasks: Task[]) {
  const { enabled, reminderMinutes } = useNotificationSettings()
  const { toast } = useToast()
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const notifiedKeysRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!notifiedKeysRef.current) notifiedKeysRef.current = loadNotifiedKeys()

    function check() {
      const current = tasksRef.current
      const pruned = pruneNotifiedKeys(current, notifiedKeysRef.current!)
      const due = selectTasksToNotify(current, new Date(), reminderMinutes, pruned)

      const next = new Set(pruned)
      for (const task of due) {
        const message = `「${task.title}」の期限が近づいています(${task.dueTime})`
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('タスク期限通知', { body: message })
        } else {
          toast.info(message)
        }
        next.add(buildNotifiedKey(task))
      }

      if (pruned.size !== notifiedKeysRef.current!.size || due.length > 0) {
        notifiedKeysRef.current = next
        saveNotifiedKeys(next)
      }
    }

    check()
    const id = setInterval(check, CHECK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [enabled, reminderMinutes, toast])
}
