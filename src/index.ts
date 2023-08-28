import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import chalk from 'chalk'

import { checkTooling } from './actions/check.ts'
import { lastCommits } from './actions/last-commits.ts'
import { hasNewVersion, hasNewVersionCached, updateToNewestVersion, writeNewVersionCache } from './self-updater.ts'
import { log } from './common/log.ts'
import packageJson from '../tsm-cli/package.json'
import { openPrs } from './actions/prs.ts'
import { getRepoMainBranch } from './actions/repo-metadata.ts'

if (Bun.argv.find((it) => it.includes('check-version')) == null) {
    // Only spawn a background version check all other args, or else we get a infinite loop of spawns
    Bun.spawn('tsm check-version'.split(' ')).unref()

    if (Bun.argv.find((it) => it === 'update') == null) {
        // Check cache and notify if there is a new version
        const newVersion = await hasNewVersionCached()
        if (newVersion) {
            log(
                `\n\tNew version available! ${chalk.yellow(packageJson.version)} -> ${chalk.green(
                    newVersion,
                )}\n\n\tRun ${chalk.cyan('tsm update')} to update\n`,
            )
        }
    }
}

await yargs(hideBin(process.argv))
    .scriptName('tsm')
    .command('check', 'check that all tooling looks OK', async () => checkTooling())
    .command(
        'commits',
        'get the last commits for every repo in the team',
        (yargs) =>
            yargs
                .positional('order', {
                    type: 'string',
                    default: 'desc',
                    describe: 'the order the commits should be sorted in',
                    choices: ['asc', 'desc'],
                })
                .positional('limit', {
                    type: 'number',
                    default: undefined,
                    describe: 'the number of commits to return',
                }),
        async (args) => lastCommits(args.order as 'asc' | 'desc', args.limit),
    )
    .command(
        'prs',
        'get all open pull requests',
        (yargs) =>
            yargs.positional('drafts', { type: 'boolean', default: false, describe: 'include draft pull requests' }),
        async (args) => openPrs(args.drafts),
    )
    .command(
        'primary-branch',
        'get misc repo metadata',
        (yargs) =>
            yargs.positional('show-main', {
                type: 'boolean',
                default: false,
                describe: 'include main branches in output',
            }),
        async (args) => getRepoMainBranch(args.showMain),
    )
    .command(
        'update',
        'update the cli',
        (yargs) => yargs,
        async () => updateToNewestVersion(),
    )
    .command(
        'check-version',
        'see if there is a new version for this cli',
        (yargs) => yargs,
        async () => {
            const newVersion = await hasNewVersion()
            if (newVersion != null) {
                await writeNewVersionCache(newVersion)
                log(`New version available! ${chalk.yellow(packageJson.version)} -> ${chalk.green(newVersion)}`)
            } else {
                log(chalk.green(`You are on the latest version!`))
            }
        },
    )
    .demandCommand()
    .strict()
    .parse()
