import type { FastifyInstance } from 'fastify'
import { createApp } from '../app.js'
import { openDatabase, type Db } from '../db.js'

export const TEST_API_KEY = 'test-key'
export const authHeaders = { 'x-api-key': TEST_API_KEY }

/** Fresh in-memory DB + app per test. Never touches the real app.sqlite. */
export async function makeTestApp(): Promise<{ db: Db; app: FastifyInstance; close: () => Promise<void> }> {
  const db = openDatabase(':memory:')
  const app = await createApp({ db, apiKey: TEST_API_KEY, logger: false })
  return { db, app, close: async () => { await app.close(); db.close() } }
}
