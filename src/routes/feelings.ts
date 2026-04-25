// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — GET /feelings
//  Returns a paginated, optionally state-filtered list of reflection logs.
// ─────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono'
import { z } from 'zod'
import { queryReflections } from '../memory/logDb.js'
import type { EmotionState } from '../core/stateTypes.js'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  state: z.enum(['CALM', 'MANIC', 'DEPRESSED']).optional(),
})

export const feelingsRouter = new Hono()

feelingsRouter.get('/', (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: parsed.error.format() }, 400)
  }

  const { limit, state } = parsed.data
  const logs = queryReflections(limit, state as EmotionState | undefined)
  return c.json(logs)
})
