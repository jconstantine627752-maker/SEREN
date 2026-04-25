// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — Shared Type Definitions
//  All domain types flow from here. Do not add side-effects to this file.
// ─────────────────────────────────────────────────────────────────────────────

/** The three mutually-exclusive internal states SEREN can occupy. */
export type EmotionState = 'CALM' | 'MANIC' | 'DEPRESSED'

/** Output of a single processSignal() call. */
export interface EmotionResult {
  state: EmotionState
  intensity: number          // 0.0 → 1.0
  previousState: EmotionState
  transitioned: boolean      // true when state changed on this call
}

/** Persisted record — written to SQLite and upserted to Qdrant. */
export interface ReflectionLog {
  id: string                 // UUID v4
  timestamp: string          // ISO 8601 UTC
  state: EmotionState
  intensity: number
  trigger: string
  felt: string
}

/** Context object handed to every plugin during a /reflect cycle. */
export interface ReflectionContext {
  trigger: string
  state: EmotionState
  intensity: number
  felt: string
  timestamp: string
}

/** Contract every SEREN plugin must satisfy. */
export interface SerenPlugin {
  name: string
  onReflect: (context: ReflectionContext) => Promise<Record<string, unknown>>
}
