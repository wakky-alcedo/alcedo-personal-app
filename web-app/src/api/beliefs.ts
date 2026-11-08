import type { Belief } from '@shared/types'
import { randomId, requestJson } from './http.ts'
import { listFrom, normalizeBelief } from './normalize.ts'

export type BeliefInput = Partial<Belief> & { text: string }

export async function getBeliefs(serverUrl: string, apiKey: string): Promise<Belief[]> {
  const payload = await requestJson<unknown>(serverUrl, apiKey, '/beliefs', 'fetch beliefs failed')
  return listFrom(payload, 'beliefs').map(normalizeBelief)
}

export function createBelief(serverUrl: string, apiKey: string, body: BeliefInput) {
  const now = new Date().toISOString()
  return requestJson<{ belief: Belief }>(serverUrl, apiKey, '/beliefs', 'create belief failed', {
    method: 'POST',
    body: {
      id: body.id ?? randomId(),
      text: body.text,
      isActive: body.isActive ?? true,
      createdAt: body.createdAt ?? now,
      updatedAt: body.updatedAt ?? now,
    },
  })
}

export function updateBelief(serverUrl: string, apiKey: string, body: Belief) {
  return requestJson<{ belief: Belief }>(serverUrl, apiKey, '/beliefs', 'update belief failed', {
    method: 'POST',
    body: { ...body, updatedAt: new Date().toISOString() },
  })
}

export function deleteBelief(serverUrl: string, apiKey: string, belief: Belief) {
  return requestJson<{ deleted: boolean }>(serverUrl, apiKey, `/beliefs/${encodeURIComponent(belief.id)}`, 'delete belief failed', { method: 'DELETE' })
}
