import fs from 'node:fs'

import yargs, { Argv } from 'yargs'
import { hideBin } from 'yargs/helpers'
import chalk from 'chalk'
import { isValid, parseISO, sub } from 'date-fns'

import packageJson from '../tsm-cli/package.json'

import { checkTooling } from './actions/check.ts'
import { auth } from './actions/auth.ts'
import { lastCommits } from './actions/last-commits.ts'
import { openPrs } from './actions/prs.ts'
import { queryForRelevantRepos } from './actions/repo-query.ts'
import { getRepos } from './actions/repos.ts'
import { getConfig, updateConfig } from './common/config.ts'
import { log, logError } from './common/log.ts'
import { pullAllRepositories } from './actions/git.ts'
import { displayMembers } from './actions/team.ts'
import { syncFileAcrossRepos } from './actions/sync-file.ts'
import { getRepoMainBranch } from './actions/repo-metadata.ts'
import { coAuthors } from './actions/co-authors.ts'
import { hasNewVersion, reportChangesSinceLast, updateToNewestVersion, writeNewVersionCache } from './self-updater.ts'
import { open } from './actions/open.ts'
import { openResource } from './actions/web.ts'
import { cleanup, kafkaConfig } from './actions/kafka.ts'
import { azure } from './actions/azure.ts'
import { updateAnalytics } from './analytics'
import { showUsageAnalytics } from './analytics/analytics-global.ts'
import { createSimpleSykmelding } from './actions/mock'
import { displayCommitsForPeriod } from './actions/work/work.ts'

export const getYargsParser = (argv: string[]): Argv =>
    yargs(hideBin(argv))
        .scriptName('tsm')
        .command('check', 'check that all tooling looks OK', checkTooling)
        .command('auth', 'login to gcloud', auth)
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
            'work',
            'see what has happened the last week (or more)',
            (yargs) =>
                yargs
                    .positional('fom', { type: 'string' })
                    .positional('days', { type: 'string', implies: 'fom' })
                    .option('unknown', {
                        type: 'boolean',
                        describe: 'include uncategorized commits',
                    }),
            (args) => {
                if (args.fom && !isValid(parseISO(args.fom))) {
                    log(`The value ${chalk.red(args.fom)} is not a valid date`)
                    return
                }

                const fom = args.fom ? parseISO(args.fom) : sub(new Date(), { days: 7 })
                const days = args.days ? parseInt(args.days) : 7

                return displayCommitsForPeriod(fom, days, args.unknown ?? false)
            },
        )
        .command(
            'mock',
            'do stuff with the mock',
            (yargs) =>
                yargs.command(
                    'simple-sykmelding',
                    'create a basic 100% sykmelding',
                    (yargs) =>
                        yargs.positional('fnr', {
                            type: 'string',
                            demandOption: true,
                        }),
                    async (args) => {
                        if (args.fnr == null) {
                            log(
                                `${chalk.red('Fnr required, run: ')}${chalk.yellow(
                                    'tsm mock simple-sykmelding fnr=<fnr>',
                                )}`,
                            )
                            process.exit(1)
                        }

                        await createSimpleSykmelding(args.fnr)
                    },
                ),
            () => {
                log('Use one of the following commands:')
                log('\ttsm mock simple-sykmelding fnr=<fnr>')
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
            'mob',
            'make a mob commit',
            (yargs) =>
                yargs
                    .positional('message', {
                        type: 'string',
                        alias: 'm',
                        describe: 'commit message with co-authors',
                        conflicts: 'amend',
                    })
                    .option('amend', {
                        type: 'boolean',
                        describe: 'amend the commit with co-authors',
                        conflicts: 'message',
                    }),
            async (args) => coAuthors(args.message, args.amend),
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
                if (args.gitDir == null) {
                    log(`${chalk.red('git dir option required, run: ')}${chalk.yellow('tsm config --git-dir=<dir>')}`)
                    process.exit(1)
                }

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

                    reportChangesSinceLast(packageJson.version)
                } else {
                    log(chalk.green(`You are on the latest version!`))
                }
            },
        )
        .command('changelog', 'get the latest changes in tsm cli', async () => {
            await reportChangesSinceLast(null)
        })
        .command('analytics', 'get your own usage stats for tsm cli', async () => {
            await showUsageAnalytics()
        })
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
        .command(
            'azure',
            'azure cli for azure stuff',
            (yargs) =>
                yargs.command(
                    'token [scope] [app]',
                    'get token for azure app for scope',
                    (yargs) =>
                        yargs
                            .positional('scope', {
                                type: 'string',
                                describe: 'scope',
                            })
                            .positional('app', {
                                type: 'string',
                                default: null,
                                describe: 'app name',
                            }),
                    async (args) => {
                        if (args.scope != null) {
                            await azure(args.app, args.scope)
                        } else {
                            logError(`\n${args.env} is not a valid env, use one of: dev, demo, prod\n`)
                            process.exit(1)
                        }
                    },
                ),
            () => {
                log('Use one of the following commands: ')
                log('\ttsm azure token "scope" "app-name"')
            },
        )
        .middleware(async (yargs) => {
            const { $0: _, _: command, ...args } = yargs

            if (command[0] === 'update') {
                // Ignore update command, since it's always being run
                return
            }

            updateAnalytics(command, args)
        })
