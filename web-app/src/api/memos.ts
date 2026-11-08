import type { Memo } from '@shared/types'
import { randomId, request, requestJson } from './http.ts'

const MEMO_PAGE_LIMIT = '200'

export async function getMemos(serverUrl: string, apiKey: string, since?: string): Promise<Memo[]> {
  const params = new URLSearchParams({ limit: MEMO_PAGE_LIMIT })
  if (since) params.set('since', since)
  const payload = await requestJson<{ memos?: Memo[] }>(serverUrl, apiKey, `/memos?${params}`, 'fetch memos failed')
  return payload.memos ?? []
}

export async function createMemo(
  serverUrl: string,
  apiKey: string,
  body: string,
  sourceUrl?: string,
  sourceTitle?: string,
): Promise<void> {
  const now = new Date().toISOString()
  await request(serverUrl, apiKey, '/sync/memos', 'create memo failed', {
    method: 'POST',
    body: {
      upserts: [{
        id: randomId(),
        body,
        sourceUrl: sourceUrl ?? null,
        sourceTitle: sourceTitle ?? null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }],
      deletions: [],
    },
  })
}

export async function updateMemo(serverUrl: string, apiKey: string, id: string, body: string): Promise<void> {
  await request(serverUrl, apiKey, `/memos/${encodeURIComponent(id)}`, 'update memo failed', { method: 'PATCH', body: { body } })
}

export async function deleteMemo(serverUrl: string, apiKey: string, id: string): Promise<void> {
  await request(serverUrl, apiKey, `/memos/${encodeURIComponent(id)}`, 'delete memo failed', { method: 'DELETE' })
}
