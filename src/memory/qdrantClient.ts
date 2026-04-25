// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — Qdrant Vector Memory Client
//
//  Embeds emotion events using OpenAI text-embedding-3-small (1536 dims)
//  and upserts them into a Qdrant collection for semantic recall.
//  Collection is auto-created on startup if absent.
// ─────────────────────────────────────────────────────────────────────────────

import { QdrantClient } from '@qdrant/js-client-rest'
import OpenAI from 'openai'
import type { ReflectionLog } from '../core/stateTypes.js'
import { logger } from '../utils/logger.js'

const VECTOR_SIZE = 1536

let _qdrant: QdrantClient
let _openai: OpenAI
let _collection: string
let _ready = false

export function initQdrant(url: string, collection: string, apiKey: string): void {
  _qdrant     = new QdrantClient({ url })
  _openai     = new OpenAI({ apiKey })
  _collection = collection
  logger.info('Qdrant client configured', { url, collection })
}

export async function createCollectionIfNotExists(): Promise<void> {
  const { collections } = await _qdrant.getCollections()
  const exists = collections.some((c) => c.name === _collection)

  if (!exists) {
    await _qdrant.createCollection(_collection, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    })
    logger.info('Qdrant collection created', { collection: _collection })
  } else {
    logger.info('Qdrant collection ready', { collection: _collection })
  }
  _ready = true
}

async function embed(text: string): Promise<number[]> {
  const res = await _openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

export async function upsertEmotion(log: ReflectionLog): Promise<void> {
  const text   = `${log.state} | ${log.trigger} | ${log.felt}`
  const vector = await embed(text)

  await _qdrant.upsert(_collection, {
    points: [{
      id:      log.id,
      vector,
      payload: {
        state:     log.state,
        intensity: log.intensity,
        trigger:   log.trigger,
        felt:      log.felt,
        timestamp: log.timestamp,
      },
    }],
  })

  logger.info('Emotion vector upserted', { id: log.id, state: log.state })
}

export async function searchSimilar(query: string, limit = 5): Promise<ReflectionLog[]> {
  const vector  = await embed(query)
  const results = await _qdrant.search(_collection, { vector, limit, with_payload: true })
  return results.map((r) => r.payload as unknown as ReflectionLog)
}

export function isQdrantReady(): boolean {
  return _ready
}
