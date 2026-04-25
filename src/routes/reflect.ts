// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — GET /reflect
//
//  Orchestrates a full reflection cycle:
//    1. Validate query params (Zod)
//    2. Score the trigger → emotional state + intensity (EmotionEngine)
//    3. Generate first-person felt-text (FeltGenerator)
//    4. Persist to SQLite (synchronous, blocks response)
//    5. Upsert to Qdrant (async, fire-and-forget — never delays response)
//    6. Run all loaded plugins (parallel)
//    7. Return JSON
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { processSignal } from '../core/emotionEngine.js'
import { generateFelt } from '../core/feltGenerator.js'
import { writeReflection } from '../memory/logDb.js'
import { upsertEmotion } from '../memory/qdrantClient.js'
import { runPlugins } from '../plugins/loader.js'
import type { ReflectionLog } from '../core/stateTypes.js'
import { logger } from '../utils/logger.js'

const querySchema = z.object({
  trigger:        z.string().min(1).max(500),
  intensity_hint: z.coerce.number().min(0).max(1).optional(),
})

export const reflectRouter = new Hono()

reflectRouter.get('/', async (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: parsed.error.format() }, 400)
  }

  const { trigger, intensity_hint } = parsed.data
  const timestamp = new Date().toISOString()

  // ── Core processing (pure, synchronous) ────────────────────────────────────
  const emotion = processSignal(trigger, intensity_hint)
  const felt    = generateFelt(emotion.state, emotion.intensity)
  const id      = uuidv4()

  const log: ReflectionLog = {
    id, timestamp,
    state:     emotion.state,
    intensity: emotion.intensity,
    trigger,
    felt,
  }

  // ── Persistence ─────────────────────────────────────────────────────────────
  try {
    writeReflection(log)
  } catch (err) {
    logger.error('SQLite write failed', { error: String(err) })
  }

  // Fire-and-forget — Qdrant upsert runs after response is sent
  upsertEmotion(log).catch((err) =>
    logger.error('Qdrant upsert failed', { error: String(err) }),
  )

  // ── Plugins ─────────────────────────────────────────────────────────────────
  const plugin_outputs = await runPlugins({ trigger, state: emotion.state, intensity: emotion.intensity, felt, timestamp })

  logger.info('Reflection complete', {
    id,
    state:       emotion.state,
    intensity:   emotion.intensity,
    transitioned: emotion.transitioned,
  })

  return c.json({ timestamp, state: emotion.state, intensity: emotion.intensity, felt, plugin_outputs })
})
