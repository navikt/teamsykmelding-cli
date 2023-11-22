import path from 'node:path'

import * as R from 'remeda'
import chalk from 'chalk'

import { CONFIG_DIR } from '../common/config.ts'
import { log } from '../common/log.ts'
import { IS_DEV } from '../common/env.ts'

import { Usage, UserCommandUsage } from './types.ts'
import { applyDiff } from './diff.ts'

export async function showUsageAnalytics(): Promise<void> {
    const { usage, user } = await loadGlobalAnalytics()

    log(`Analytics of ${chalk.blueBright('tsm')} usage for ${chalk.greenBright(user)}:`)
    R.pipe(
        usage,
        R.toPairs,
        R.sortBy([([, value]) => value.usage, 'desc']),
        R.forEach(([key, value]) => {
            log(`  ${chalk.blueBright(key)}: ${chalk.green(value.usage)}`)
            R.pipe(
                value.argsUsage,
                R.toPairs,
                R.forEach(([key, value]) => {
                    log(`    ${chalk.yellow(key)}: ${chalk.green(value)}`)
                }),
            )
        }),
    )
}

export async function updateGlobalAnalytics(diff: Usage): Promise<void> {
    const globalAnalytics = await loadGlobalAnalytics()
    const updatedGlobalAnalytics = applyDiff(diff, globalAnalytics)

    await saveGlobalAnalytics(updatedGlobalAnalytics)
}

async function loadGlobalAnalytics(): Promise<UserCommandUsage> {
    const cachedAnalytics = Bun.file(path.join(CONFIG_DIR, `analytics${IS_DEV ? '-dev' : ''}.json`))
    if (!(await cachedAnalytics.exists())) return { user: Bun.env.USER ?? 'unknown', usage: {} }

    return await cachedAnalytics.json<UserCommandUsage>()
}

async function saveGlobalAnalytics(updated: UserCommandUsage): Promise<void> {
    const cachedAnalytics = Bun.file(path.join(CONFIG_DIR, `analytics${IS_DEV ? '-dev' : ''}.json`))
    await Bun.write(cachedAnalytics, JSON.stringify(updated))
}
