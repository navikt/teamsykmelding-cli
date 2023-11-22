import path from 'node:path'

import { CONFIG_DIR } from '../common/config.ts'

import { Usage, UserCommandUsage } from './types.ts'
import { applyDiff } from './diff.ts'

export async function updateGlobalAnalytics(diff: Usage): Promise<void> {
    const globalAnalytics = await loadGlobalAnalytics()
    const updatedGlobalAnalytics = applyDiff(diff, globalAnalytics)

    await saveGlobalAnalytics(updatedGlobalAnalytics)
}

async function loadGlobalAnalytics(): Promise<UserCommandUsage> {
    const cachedAnalytics = Bun.file(path.join(CONFIG_DIR, 'analytics.json'))
    if (!(await cachedAnalytics.exists())) return { user: Bun.env.USER ?? 'unknown', usage: {} }

    return await cachedAnalytics.json<UserCommandUsage>()
}

async function saveGlobalAnalytics(updated: UserCommandUsage): Promise<void> {
    const cachedAnalytics = Bun.file(path.join(CONFIG_DIR, 'analytics.json'))
    await Bun.write(cachedAnalytics, JSON.stringify(updated))
}
