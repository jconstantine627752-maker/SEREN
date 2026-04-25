// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — Emotion Engine
//  Pure function. No I/O. No side effects. All DB/memory writes happen in
//  route handlers AFTER calling processSignal().
// ─────────────────────────────────────────────────────────────────────────────

import type { EmotionState, EmotionResult } from './stateTypes.js'

// ── Sentiment Lexicons ────────────────────────────────────────────────────────
// Each word maps to a weight in [0.0, 1.0] representing emotional magnitude.

const POSITIVE: Record<string, number> = {
  pump: 0.80, moon: 0.90, bullish: 0.70, rally: 0.75, surge: 0.80,
  breakout: 0.70, ath: 0.90, gain: 0.60, green: 0.50, profit: 0.65,
  win: 0.60, good: 0.40, great: 0.55, amazing: 0.70, excited: 0.65,
  happy: 0.55, joy: 0.60, love: 0.50, up: 0.40, buy: 0.50,
  launch: 0.60, success: 0.65, growth: 0.60, positive: 0.55, rise: 0.60,
}

const NEGATIVE: Record<string, number> = {
  dump: 0.80, crash: 0.90, bearish: 0.70, drop: 0.65, fall: 0.60,
  rekt: 0.90, loss: 0.70, red: 0.50, bad: 0.40, terrible: 0.70,
  sad: 0.55, angry: 0.65, hate: 0.60, pain: 0.65, fear: 0.70,
  panic: 0.85, liquidation: 0.90, sell: 0.45, down: 0.40,
  fail: 0.65, broken: 0.60, wrong: 0.50, negative: 0.55, bleed: 0.70,
}

// ── Module-level state (in-memory transition tracking) ────────────────────────
let _previousState: EmotionState = 'CALM'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract a signed percentage value from strings like "BTC +12% 1h" → 12. */
function extractPercentage(trigger: string): number | null {
  const match = trigger.match(/([+-]?\d+(?:\.\d+)?)\s*%/)
  return match ? parseFloat(match[1]) : null
}

/**
 * Score the raw trigger string.
 * Returns polarity in [-1, +1] and magnitude in [0, 1].
 */
function scoreTrigger(trigger: string): { polarity: number; magnitude: number } {
  const words = trigger.toLowerCase().split(/\W+/)

  let pos = 0
  let neg = 0

  for (const word of words) {
    if (POSITIVE[word]) pos += POSITIVE[word]
    if (NEGATIVE[word]) neg += NEGATIVE[word]
  }

  // Boost scores from an explicit percentage signal
  const pct = extractPercentage(trigger)
  if (pct !== null) {
    const pctWeight = Math.min(Math.abs(pct) / 20, 1.0) // 20 % = full weight
    pct > 0 ? (pos += pctWeight) : (neg += pctWeight)
  }

  const total = pos + neg
  if (total === 0) return { polarity: 0, magnitude: 0.05 }

  return {
    polarity:  (pos - neg) / total,              // [-1, +1]
    magnitude: Math.min(total / 2, 1.0),         // [0, 1]
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Process an incoming signal and return the resulting emotional state.
 *
 * @param trigger       Raw signal string (text, market label, event name).
 * @param intensityHint Optional override for intensity (0.0 – 1.0).
 */
export function processSignal(trigger: string, intensityHint?: number): EmotionResult {
  const { polarity, magnitude } = scoreTrigger(trigger)

  let state: EmotionState
  let intensity: number

  if (intensityHint !== undefined) {
    intensity = Math.max(0, Math.min(1, intensityHint))
    state = polarity > 0.1 && intensity > 0.45
      ? 'MANIC'
      : polarity < -0.1 && intensity > 0.45
      ? 'DEPRESSED'
      : 'CALM'
  } else {
    intensity = magnitude
    state = polarity > 0.2 && magnitude > 0.4
      ? 'MANIC'
      : polarity < -0.2 && magnitude > 0.4
      ? 'DEPRESSED'
      : 'CALM'
  }

  const result: EmotionResult = {
    state,
    intensity,
    previousState: _previousState,
    transitioned:  state !== _previousState,
  }

  _previousState = state
  return result
}

/** Reset in-memory state — useful for testing. */
export function resetState(): void {
  _previousState = 'CALM'
}
