import chalk from 'chalk'

import packageJson from '../../tsm-cli/package.json'
import { log } from '../common/log.ts'

import { hasNewVersion, reportChangesSinceLast, writeNewVersionCache } from './self-updater.ts'

export async function checkForNewVersion(silent = false): Promise<void> {
    const newVersion = await hasNewVersion()
    if (newVersion != null) {
        await writeNewVersionCache(newVersion)

        if (!silent) {
            log(`New version available! ${chalk.yellow(packageJson.version)} -> ${chalk.green(newVersion)}`)
            log(`Run ${chalk.cyan('tsm upgrade')} to upgrade`)

            await reportChangesSinceLast(packageJson.version)
        }
    } else {
        if (!silent) {
            log(chalk.green(`You are on the latest version!`))
        }
    }
}
