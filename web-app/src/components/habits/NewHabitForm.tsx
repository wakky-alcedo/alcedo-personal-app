import React, { useState } from 'react'
import type { HabitInput } from '../../api.ts'
import HabitSettingsFields from './HabitSettingsFields.tsx'
import { EMPTY_HABIT_SETTINGS, settingsToHabitFields } from './habitSettings.ts'

type Props = {
  disabled: boolean
  /** Resolves true when the habit was created, so the form can reset. */
  onCreate: (input: HabitInput) => Promise<boolean>
}

export default function NewHabitForm({ disabled, onCreate }: Props) {
  const [name, setName] = useState('')
  const [settings, setSettings] = useState(EMPTY_HABIT_SETTINGS)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const created = await onCreate({ name: name.trim(), ...settingsToHabitFields(settings) })
    if (created) {
      setName('')
      setSettings(EMPTY_HABIT_SETTINGS)
    }
  }

  return (
    <form className="habit-form" onSubmit={handleSubmit}>
      <input placeholder="New habit name" value={name} onChange={e => setName(e.target.value)} />
      <HabitSettingsFields value={settings} onChange={setSettings} variant="form" />
      <button type="submit" disabled={disabled}>Add Habit</button>
    </form>
  )
}
