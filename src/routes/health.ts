// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — GET /health
//  Checks SQLite connectivity and Qdrant readiness.
//  Returns HTTP 200 if all services are healthy, HTTP 503 if degraded.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { getDb } from '../memory/logDb.js'
import { isQdrantReady } from '../memory/qdrantClient.js'
import { getLoadedPlugins } from '../plugins/loader.js'

export const healthRouter = new Hono()

healthRouter.get('/', (c) => {
  let dbStatus: 'ok' | 'error' = 'ok'
  try {
    getDb().prepare('SELECT 1').get()
  } catch {
    dbStatus = 'error'
  }

  const qdrantStatus = isQdrantReady() ? 'ok' : 'unavailable'
  const healthy      = dbStatus === 'ok'

  return c.json(
    {
      status:    healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        qdrant:   qdrantStatus,
      },
      plugins: getLoadedPlugins(),
    },
    healthy ? 200 : 503,
  )
})
