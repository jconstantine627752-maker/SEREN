// ─────────────────────────────────────────────────────────────────────────────
//  SEREN — Dynamic ESM Plugin Loader
//
//  Scans PLUGIN_DIR for subdirectories, imports index.js from each, validates
//  the SerenPlugin interface, and registers valid plugins. A plugin that throws
//  at load-time or during onReflect is silently excluded — it never crashes the
//  server.
// ─────────────────────────────────────────────────────────────────────────────

import { readdir } from 'fs/promises'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'
import type { SerenPlugin, ReflectionContext } from '../core/stateTypes.js'
import { logger } from '../utils/logger.js'

const _plugins: SerenPlugin[] = []

export async function loadPlugins(pluginDir: string): Promise<void> {
  const dir = resolve(pluginDir)

  let entries: Awaited<ReturnType<typeof readdir>>
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    logger.warn('Plugin directory unreadable — no plugins loaded', { dir })
    return
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    // Try .js (production build) then .ts (tsx dev mode)
    for (const idx of ['index.js', 'index.ts']) {
      const pluginPath = join(dir, entry.name, idx)
      try {
        const mod    = await import(pathToFileURL(pluginPath).href)
        const plugin = mod.default as SerenPlugin

        if (typeof plugin?.name !== 'string' || typeof plugin?.onReflect !== 'function') {
          logger.warn('Plugin missing required exports — skipped', { path: pluginPath })
          break
        }

        _plugins.push(plugin)
        logger.info('Plugin registered', { name: plugin.name })
        break
      } catch (err) {
        if (idx === 'index.ts') {
          logger.error('Failed to load plugin', { dir: entry.name, error: String(err) })
        }
        // else: .js not found, try .ts next iteration
      }
    }
  }
}

export async function runPlugins(
  ctx: ReflectionContext,
): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {}

  for (const plugin of _plugins) {
    try {
      out[plugin.name] = await plugin.onReflect(ctx)
    } catch (err) {
      logger.error('Plugin error during onReflect — excluded from output', {
        name:  plugin.name,
        error: String(err),
      })
    }
  }

  return out
}

export function getLoadedPlugins(): string[] {
  return _plugins.map((p) => p.name)
}
