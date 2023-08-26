import * as R from 'remeda'
import { differenceInDays, formatDistanceStrict, parseISO, subMonths } from 'date-fns'
import { getOctokitClient } from '../common/octokit.ts'
import { log } from '../common/log.ts'
import chalk from 'chalk'

type CheckSuite = {
    status: string
    conclusion: string
    workflowRun: {
        event: string
        runNumber: number
    } | null
    branch: {
        name: string
    }
}

type RepoNodes = {
    name: string
    isArchived: boolean
    pushedAt: string
    url: string
    defaultBranchRef: {
        target: {
            message: string
            checkSuites: {
                nodes: CheckSuite[]
            }
        }
    }
}

const getTeamReposQuery = /* GraphQL */ `
    query OurRepos($team: String!) {
        organization(login: "navikt") {
            team(slug: $team) {
                repositories {
                    nodes {
                        name
                        isArchived
                        pushedAt
                        url
                        defaultBranchRef {
                            target {
                                ... on Commit {
                                    message
                                    checkSuites(last: 1) {
                                        nodes {
                                            status
                                            conclusion
                                            workflowRun {
                                                event
                                                runNumber
                                            }
                                            branch {
                                                name
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`

async function getRepositories(
    team: string,
): Promise<{ name: string; lastPush: Date; commit: string; action: CheckSuite }[]> {
    log(chalk.green(`Getting repositories for team ${team}`))

    const queryResult = (await getOctokitClient().graphql(getTeamReposQuery, {
        team,
    })) as any

    const repos = R.pipe(
        queryResult.organization.team.repositories.nodes as RepoNodes[],
        R.filter((it) => !it.isArchived),
        R.map((repo) => ({
            name: repo.name,
            lastPush: parseISO(repo.pushedAt),
            commit: repo.defaultBranchRef.target.message,
            action: repo.defaultBranchRef.target.checkSuites.nodes[0],
        })),
        R.sortBy((it) => it.lastPush),
        R.reverse(),
    )

    log(`Got ${chalk.greenBright(repos.length)} repositories for team ${team}`)

    return repos
}

function coloredStatus(action: CheckSuite): string {
    if (action.workflowRun == null) {
        // Was likely skipped
        return chalk.gray('SKIPPED')
    }
    switch (action.status) {
        case 'COMPLETED':
            return chalk.green(action.status)
        case 'IN_PROGRESS':
            return chalk.yellow(action.status)
        case 'QUEUED':
            return chalk.gray(action.status)
        default:
            return chalk.red(action.status)
    }
}

function coloredTimestamp(timestamp: Date): string {
    const now = new Date()
    const daysSince = differenceInDays(now, timestamp)
    const distance = formatDistanceStrict(timestamp, now)
    if (daysSince < 7) {
        return chalk.green(distance)
    } else if (daysSince < 14) {
        return chalk.yellow(distance)
    } else {
        return chalk.cyan(distance)
    }
}

export async function lastCommits() {
    const lastCommits = await getRepositories('teamsykmelding')

    log(
        lastCommits
            .map(
                (it) =>
                    `${`${coloredStatus(it.action)}: `.padEnd(21, ' ')}${coloredTimestamp(it.lastPush)} ${it.name}: ${
                        it.commit.split('\n')[0]
                    } (${it.action.workflowRun?.event ?? 'none'})`,
            )
            .join('\n'),
    )
}
