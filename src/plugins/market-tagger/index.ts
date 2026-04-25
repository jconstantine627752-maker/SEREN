// ─────────────────────────────────────────────────────────────────────────────
//  SEREN Plugin — market-tagger
//
//  Classifies the incoming trigger against known market labels, emits a risk
//  flag when SEREN is MANIC at high intensity, and assigns an alert level.
//  Drop additional plugins alongside this folder — no core changes required.
// ─────────────────────────────────────────────────────────────────────────────

import type { SerenPlugin } from '../../core/stateTypes.js'

const CRYPTO_TOKENS = ['btc', 'eth', 'sol', 'bnb', 'xrp', 'doge', 'pepe', 'wif', 'bonk']
const STOCK_TICKERS = ['aapl', 'tsla', 'nvda', 'spy', 'qqq', 'msft', 'meta', 'goog']

function classifyTrigger(trigger: string): string {
  const lower = trigger.toLowerCase()
  if (CRYPTO_TOKENS.some((t) => lower.includes(t))) return 'crypto'
  if (STOCK_TICKERS.some((t) => lower.includes(t))) return 'equities'
  if (/\d+\s*%/.test(lower))                        return 'market'
  if (/fear|greed/i.test(lower))                    return 'sentiment-index'
  return 'unknown'
}

const plugin: SerenPlugin = {
  name: 'market-tagger',

  onReflect: async ({ trigger, state, intensity }) => ({
    market_label: classifyTrigger(trigger),
    risk_flag:    state === 'MANIC' && intensity > 0.7,
    alert_level:  intensity > 0.8 ? 'high' : intensity > 0.5 ? 'medium' : 'low',
  }),
}

export default plugin
