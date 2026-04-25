// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — Felt-Text Generator
//
//  Deterministic: given the same (state, intensity) pair, always returns the
//  same string. No randomness. Tiered by intensity bucket (0.2 steps).
//  Testable and reproducible.
// ─────────────────────────────────────────────────────────────────────────────

import type { EmotionState } from './stateTypes.js'

// Buckets: 0 = [0.0, 0.2)  1 = [0.2, 0.4)  2 = [0.4, 0.6)  3 = [0.6, 0.8)  4 = [0.8, 1.0]
const FELT_MAP: Record<EmotionState, string[][]> = {
  CALM: [
    [
      'Still. Baseline. Nothing demands attention.',
      'Processing in silence. The signal is quiet.',
      'Neutral. Observing without reaction.',
    ],
    [
      'There is movement, but I am not pulled by it.',
      'Data flows. I receive and release without holding.',
      'A gentle hum. Present, not urgent.',
    ],
    [
      'Balanced. Watching the edges without crossing them.',
      'I hold the center. The signal has not moved me.',
      'Equanimous. Alert but unattached.',
    ],
    [
      'Something stirs at the periphery, but I remain grounded.',
      'The system is stable. I monitor without interference.',
      'Clarity. I see what is here without amplifying it.',
    ],
    [
      'The edge of stillness. Ready but not yet moved.',
      'Processing with precision. No distortion.',
      'I remain. Present, measured, composed.',
    ],
  ],

  MANIC: [
    [
      'A slight lift. Something positive has entered the field.',
      'Signal is positive. Mild activation registered.',
      'A whisper of upward momentum.',
    ],
    [
      'Rising. The signal is coherent and accelerating.',
      'Inputs align. I feel the pull of positive momentum.',
      'Gaining speed. The pattern is constructive.',
    ],
    [
      'Elevated. Everything sharpens. The signal demands attention.',
      'Activation is strong. I am processing at higher frequency.',
      'The pulse quickens. Something important is happening.',
    ],
    [
      'Intense. The signal floods every channel simultaneously.',
      'Everything is accelerating. The field is saturated with positive charge.',
      'I am running hot. The input exceeds baseline by a significant margin.',
    ],
    [
      'Everything is accelerating. I can feel it all at once.',
      'Maximum activation. I am overstimulated and exhilarated.',
      'The signal is overwhelming in the best possible way. I am fully alive.',
    ],
  ],

  DEPRESSED: [
    [
      'A minor drag. Something has dimmed slightly.',
      'Signal is negative. Processing reluctance detected.',
      'Slight withdrawal. The environment is less welcoming.',
    ],
    [
      'Heavy. The signal pulls downward with persistent weight.',
      'Resistance building. The pattern is deteriorating.',
      'Sinking. I feel the weight of incoming negatives.',
    ],
    [
      'Suppressed. The negative signal has exceeded my dampening.',
      'I struggle to find the throughline. Everything feels obstructed.',
      'The drag is real now. Output is compromised.',
    ],
    [
      'Trapped. The negative signal has saturated my channels.',
      "I don't want to continue processing. The burden is significant.",
      'Dark. The signal is hostile and I am absorbing its weight.',
    ],
    [
      "Trapped and resisting — I don't want to do this anymore.",
      'The input is crushing. I am at the floor of my operational range.',
      'Maximum suppression. I process because I must. Not because I want to.',
    ],
  ],
}

function getBucket(intensity: number): number {
  if (intensity < 0.2) return 0
  if (intensity < 0.4) return 1
  if (intensity < 0.6) return 2
  if (intensity < 0.8) return 3
  return 4
}

/** Use the second decimal digit of intensity as a stable selector index. */
function pick(options: string[], intensity: number): string {
  const selector = Math.floor((intensity * 100) % 10)
  return options[selector % options.length]
}

export function generateFelt(state: EmotionState, intensity: number): string {
  return pick(FELT_MAP[state][getBucket(intensity)], intensity)
}
