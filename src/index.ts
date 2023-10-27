import fs from 'node:fs'

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import chalk from 'chalk'

import packageJson from '../tsm-cli/package.json'

import { checkTooling } from './actions/check.ts'
import { lastCommits } from './actions/last-commits.ts'
import { hasNewVersion, hasNewVersionCached, updateToNewestVersion, writeNewVersionCache } from './self-updater.ts'
import { log, logError } from './common/log.ts'
import { openPrs } from './actions/prs.ts'
import { getRepoMainBranch } from './actions/repo-metadata.ts'
import { getRepos } from './actions/repos.ts'
import { displayMembers } from './actions/team.ts'
import { queryForRelevantRepos } from './actions/repo-query.ts'
import { getConfig, updateConfig } from './common/config.ts'
import { pullAllRepositories } from './actions/git.ts'
import { open } from './actions/open.ts'
import { cleanup, kafkaConfig } from './actions/kafka.ts'
import { syncFileAcrossRepos } from './actions/sync-file.ts'
import { openResource } from './actions/web.ts'
import { auth } from './actions/auth.ts'

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

await yargs(hideBin(process.argv))
    .scriptName('tsm')
    .command('check', 'check that all tooling looks OK', async () => checkTooling())
    .command('auth', 'login to gcloud', async () => auth())
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
            yargs
                .option('skip-bots', { type: 'boolean', alias: 'b', describe: "don't include bot pull requests" })
                .positional('drafts', { type: 'boolean', default: false, describe: 'include draft pull requests' }),
        async (args) => openPrs(args.drafts, args.skipBots ?? false),
    )
    .command(
        'repos',
        'get all repos',
        (yargs) =>
            yargs.positional('query', {
                type: 'string',
                demandOption: false,
                describe: 'execute this bash command in all repos and return all repos that give the error code 0',
            }),
        async (args) => (args.query ? queryForRelevantRepos(args.query) : getRepos()),
    )
    .command(
        'git',
        'keep our repos in sync, ex: tsm git sync',
        (yargs) =>
            yargs.command('sync', 'Clone and/or update all repos (with no unstaged changes)', async () => {
                const config = await getConfig()
                if (config.gitDir == null) {
                    log(`${chalk.red('Git dir not set, run: ')}${chalk.yellow('tsm config --git-dir=<dir>')}`)
                    process.exit(1)
                }

                await pullAllRepositories(config.gitDir)
            }),
        () => {
            log('Use one of the following commands:')
            log('\ttsm git sync')
        },
    )
    .command(
        'team',
        'get all team members',
        (yargs) =>
            yargs.positional('name', {
                type: 'string',
                description: 'override team to look up, ex: tsm team --name=flex',
            }),
        async (yargs) => displayMembers(yargs.name ?? null),
    )
    .command(
        'sync-file',
        'sync a file across specified repos',
        (yargs) =>
            yargs.positional('query', {
                type: 'string',
                demandOption: true,
                describe: 'execute this bash command in all repos and return all repos that give the error code 0',
            }),
        async (args) => syncFileAcrossRepos(args.query),
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
        'config',
        'set config for tsm',
        (yargs) =>
            yargs.positional('git-dir', {
                type: 'string',
                describe: 'set the git dir to use for tsm git commands',
            }),
        async (args) => {
            if (args.gitDir) {
                if (!(fs.existsSync(args.gitDir) && fs.statSync(args.gitDir).isDirectory())) {
                    log(`${chalk.red('Git dir does not exist: ')}${chalk.yellow(args.gitDir)}`)
                    log(`Please provide a full path to an existing directory. :)`)
                    if (args.gitDir.includes('~')) {
                        log('Hint: ~ is not expanded in node, use $HOME instead')
                    }
                    process.exit(1)
                }
                await updateConfig({
                    gitDir: args.gitDir,
                })
            }
        },
    )
    .command(
        'upgrade',
        'update the cli',
        (yargs) => yargs,
        async () => updateToNewestVersion(),
    )
    .command(
        'update',
        'see if there is a new version for this cli',
        (yargs) => yargs,
        async () => {
            const newVersion = hasNewVersion()
            if (newVersion != null) {
                await writeNewVersionCache(newVersion)
                log(`New version available! ${chalk.yellow(packageJson.version)} -> ${chalk.green(newVersion)}`)
                log(`Run ${chalk.cyan('tsm upgrade')} to upgrade`)
            } else {
                log(chalk.green(`You are on the latest version!`))
            }
        },
    )
    .command(
        'open [project]',
        'open command that opens a project in IntelliJ IDEA',
        (yargs) =>
            yargs.positional('project', {
                type: 'string',
                description: 'project to open',
                default: null,
            }),
        async (args) => {
            await open(args.project ?? null)
        },
    )
    .command(
        'web [what]',
        'open web page',
        (yargs) =>
            yargs
                .positional('what', {
                    type: 'string',
                    description: 'what to open, e.g. "docs"',
                    default: null,
                })
                .positional('env', {
                    type: 'string',
                    description: 'if app is provided, what env, e.g. "dev"',
                    default: null,
                }),
        async (args) => {
            if (args.env != null && !['dev', 'demo', 'prod'].includes(args.env)) {
                logError(`\n${args.env} is not a valid env, use one of: dev, demo, prod\n`)
                process.exit(1)
            }

            await openResource(args.what ?? null, args.env ?? null)
        },
    )
    .command(
        'kafka',
        'kafka cli for kafka stuff',
        (yargs) =>
            yargs
                .command(
                    'config [app]',
                    'get config for kafka for app',
                    (yargs) =>
                        yargs.positional('app', {
                            type: 'string',
                            default: null,
                            describe: 'app name',
                        }),
                    async (args) => {
                        await kafkaConfig(args.app)
                    },
                )
                .command(
                    'clean',
                    'clean up kafka config',
                    (yargs) => yargs,
                    async () => {
                        await cleanup()
                    },
                ),
        () => {
            log('Use one of the following commands:')
            log('\ttsm kafka config "app-name"')
        },
    )
    .demandCommand()
    .strict()
    .parse()
