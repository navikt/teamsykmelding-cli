import { $ } from 'bun'
import * as R from 'remeda'

import { Config } from './config.ts'

export async function badBrews(): Promise<string[]> {
    const brewChecks = await Promise.allSettled(
        Config.map(async (it) => {
            const output = await $`which ${it}`.throws(false).quiet()

            // Probably not installed
            if (output.exitCode !== 0) return null

            const isBrew = output.stdout.toString().includes('brew')
            return isBrew ? it : null
        }),
    )

    return R.pipe(
        brewChecks,
        R.filter((it): it is PromiseFulfilledResult<string> => it.status === 'fulfilled'),
        R.map((it) => it.value),
        R.filter(R.isTruthy),
    )
}
