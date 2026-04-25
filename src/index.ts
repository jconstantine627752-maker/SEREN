// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — Hono Application Entrypoint
//  Boot order: DB → Qdrant → Plugins → Server
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { logger } from './utils/logger.js'
import { initDb } from './memory/logDb.js'
import { initQdrant, createCollectionIfNotExists } from './memory/qdrantClient.js'
import { loadPlugins } from './plugins/loader.js'
import { reflectRouter } from './routes/reflect.js'
import { feelingsRouter } from './routes/feelings.js'
import { healthRouter } from './routes/health.js'

const PORT            = parseInt(process.env.PORT            ?? '3000',              10)
const QDRANT_URL      = process.env.QDRANT_URL               ?? 'http://localhost:6333'
const QDRANT_COLL     = process.env.QDRANT_COLLECTION        ?? 'seren_emotions'
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY           ?? ''
const DATABASE_URL    = process.env.DATABASE_URL             ?? './seren.db'
const PLUGIN_DIR      = process.env.PLUGIN_DIR               ?? './src/plugins'

async function boot(): Promise<void> {
  // ── 1. SQLite ───────────────────────────────────────────────────────────────
  initDb(DATABASE_URL)

  // ── 2. Qdrant ───────────────────────────────────────────────────────────────
  initQdrant(QDRANT_URL, QDRANT_COLL, OPENAI_API_KEY)
  await createCollectionIfNotExists().catch((err) => {
    logger.warn('Qdrant unavailable at boot — vector memory disabled', { error: String(err) })
  })

  // ── 3. Plugins ──────────────────────────────────────────────────────────────
  await loadPlugins(PLUGIN_DIR)

  // ── 4. Hono app ─────────────────────────────────────────────────────────────
  const app = new Hono()

  app.route('/reflect',  reflectRouter)
  app.route('/feelings', feelingsRouter)
  app.route('/health',   healthRouter)

  app.notFound((c) => c.json({ error: 'Not found' }, 404))
  app.onError((err, c) => {
    logger.error('Unhandled server error', { message: err.message })
    return c.json({ error: 'Internal server error' }, 500)
  })

  serve({ fetch: app.fetch, port: PORT }, () => {
    logger.info('SEREN online', { port: PORT, plugins: PLUGIN_DIR })
  })
}

boot().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
