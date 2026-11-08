import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import HabitsPanel from './HabitsPanel.tsx'
import { ToastProvider } from '../contexts/ToastContext.tsx'
import ToastContainer from './ToastContainer.tsx'

const habit = {
  id: 'h1', name: 'Run', notifyTime: null, widgetPriorityTimeRangeStart: null, widgetPriorityTimeRangeEnd: null,
  allowedMissDays: 0, isActive: true, createdAt: '', updatedAt: '', completedToday: false, streakDays: 2, lastDoneDate: null,
}

function stubServer({ checkInStatus = 200 } = {}) {
  const calls: Array<{ url: string; method: string; body?: string }> = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined })
    if (url.includes('/habits/logs')) return new Response('[]')
    if (url.endsWith('/habits/h1/logs')) return new Response('{}', { status: checkInStatus })
    return new Response(JSON.stringify({ habits: [habit] }))
  }))
  return calls
}

function renderPanel(compact: boolean) {
  return render(<ToastProvider><HabitsPanel compact={compact} /><ToastContainer /></ToastProvider>)
}

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('HabitsPanel', () => {
  it('loads habits and checks in without a client-side date', async () => {
    const calls = stubServer()
    renderPanel(true)
    const button = await screen.findByRole('button', { name: /Run/ })
    expect(button.textContent).toContain('🔥2')
    fireEvent.click(button)
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/habits/h1/logs'))).toBe(true))
    expect(calls.find(c => c.method === 'POST')!.body).toBe('{}')
  })

  it('shows a toast when the check-in fails, without refetch loops', async () => {
    const calls = stubServer({ checkInStatus: 500 })
    renderPanel(false)
    fireEvent.click(await screen.findByRole('button', { name: /Run/ }))
    expect(await screen.findByText('チェックインに失敗しました')).toBeTruthy()
    // initial load (2) + refresh after the failed mutation (2) + the POST; no runaway refetching.
    await new Promise(r => setTimeout(r, 50))
    expect(calls.filter(c => c.method === 'GET')).toHaveLength(4)
  })

  it('creates a habit from the form and resets it', async () => {
    const calls = stubServer()
    renderPanel(false)
    fireEvent.click(await screen.findByRole('button', { name: /All habits/ }))
    const input = screen.getByPlaceholderText('New habit name') as HTMLInputElement
    fireEvent.change(input, { target: { value: '  Read  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Habit' }))
    await waitFor(() => expect(input.value).toBe(''))
    const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/api/v1/habits'))!
    expect(JSON.parse(post.body!)).toMatchObject({ name: 'Read', allowedMissDays: 0, isActive: true, notifyTime: null })
  })
})
