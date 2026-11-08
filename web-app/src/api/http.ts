const API_PREFIX = '/api/v1'

/** Thrown for non-2xx responses; `status` lets callers distinguish e.g. 404 from 500. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  /** JSON-encoded when present. Omit for bodiless requests: Fastify rejects an empty JSON body. */
  body?: unknown
}

/** Single place that adds auth, encodes the body and turns HTTP errors into ApiError. */
export async function request(
  serverUrl: string,
  apiKey: string,
  path: string,
  errorMessage: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<Response> {
  const headers: Record<string, string> = { 'X-Api-Key': apiKey }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${serverUrl}${API_PREFIX}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new ApiError(errorMessage, res.status)
  return res
}

export async function requestJson<T>(
  serverUrl: string,
  apiKey: string,
  path: string,
  errorMessage: string,
  options?: RequestOptions,
): Promise<T> {
  const res = await request(serverUrl, apiKey, path, errorMessage, options)
  return res.json() as Promise<T>
}

export function randomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
