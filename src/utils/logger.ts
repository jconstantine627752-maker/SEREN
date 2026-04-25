// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — Structured JSON Logger
// ─────────────────────────────────────────────────────────────────────────────

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }
  const line = JSON.stringify(entry)
  level === 'error' ? console.error(line) : console.log(line)
}

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => emit('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => emit('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => emit('debug', msg, meta),
}
