import chalk from 'chalk'

import packageJson from '../tsm-cli/package.json'

import { hasNewVersionCached } from './self-updater.ts'
import { log } from './common/log.ts'
import { getYargsParser } from './yargs-parser.ts'

if (
    Bun.argv.find((it) => it.includes('update')) == null &&
    // when sanity checking bundle, don't look for new updates
    !Bun.argv[1].includes('tsm-cli/bin')
) {
    // Only spawn a background version check all other args, or else we get a infinite loop of spawns
    Bun.spawn('tsm update'.split(' ')).unref()

    if (Bun.argv.find((it) => it === 'upgrade') == null) {
        // Check cache and notify if there is a new version
        const newVersion = await hasNewVersionCached()
        if (newVersion) {
            log(
                `\n\tNew version available! ${chalk.yellow(packageJson.version)} -> ${chalk.green(
                    newVersion,
                )}\n\n\tRun ${chalk.cyan('tsm upgrade')} to upgrade\n`,
            )
        }
    }
}

await getYargsParser(process.argv).demandCommand().strict().parse()
