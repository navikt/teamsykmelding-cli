import chalk from 'chalk'
import * as R from 'remeda'
import { parseISO } from 'date-fns'

import { log } from '../../common/log.ts'
import { BaseRepoNodeFragment, ghGqlQuery, OrgTeamRepoResult, removeIgnoredAndArchived } from '../../common/octokit.ts'
import { getTeam } from '../../common/config.ts'
import { coloredTimestamp } from '../../common/date-utils.ts'

type CheckSuite = {
    status: string
    conclusion: string
    workflowRun: {
        event: string
        runNumber: number
        updatedAt: string
    } | null
    branch: {
        name: string
    }
}

type BranchRefNode = {
    defaultBranchRef: {
        target: {
            message: string
            checkSuites: {
                nodes: CheckSuite[]
            }
        }
    }
}

const reposQuery = /* GraphQL */ `
    query OurRepos($team: String!) {
        organization(login: "navikt") {
            team(slug: $team) {
                repositories(orderBy: { field: PUSHED_AT, direction: DESC }) {
                    nodes {
                        ...BaseRepoNode
                        defaultBranchRef {
                            target {
                                ... on Commit {
                                    message
                                    checkSuites(last: 10) {
                                        nodes {
                                            status
                                            conclusion
                                            workflowRun {
                                                event
                                                runNumber
                                                updatedAt
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

    ${BaseRepoNodeFragment}
`

export async function checkBuilds(): Promise<void> {
    const team = await getTeam()
    log(chalk.green(`Checking build status for all ${team} repos... \t`))

    const queryResult = await ghGqlQuery<OrgTeamRepoResult<BranchRefNode>>(reposQuery, {
        team,
    })

    const reposByState = R.pipe(
        queryResult.organization.team.repositories.nodes,
        removeIgnoredAndArchived,
        R.map((repo) => ({
            name: repo.name,
            lastPush: parseISO(repo.pushedAt),
            commit: repo.defaultBranchRef.target.message,
            action: R.pipe(
                repo.defaultBranchRef.target.checkSuites.nodes,
                R.sortBy([(it) => it.workflowRun?.updatedAt ?? '', 'desc']),
                R.find((it) => it.workflowRun?.event === 'push'),
            ),
        })),
        R.filter((it) => it.action?.workflowRun != null),
        R.groupBy((it) => it.action?.conclusion ?? 'unknown'),
    )

    const { SUCCESS, FAILURE, CANCELLED, ...rest } = reposByState

    log(`Found ${R.pipe(reposByState, R.toPairs, R.flatMap(R.last), R.length)} repos with build status`)
    log(chalk.green(`  Success: ${SUCCESS?.length ?? 0} repos`))
    log(chalk.red(`  Failure: ${FAILURE?.length ?? 0}`))
    for (const repo of FAILURE ?? []) {
        log(
            chalk.red(
                `   ${repo.name} failed ${
                    repo.action?.workflowRun?.updatedAt != null
                        ? coloredTimestamp(parseISO(repo.action.workflowRun.updatedAt))
                        : 'dunno lol'
                } ago`,
            ) +
                `\n\tActions: https://github.com/navikt/${repo.name}/actions?query=branch%3A${
                    repo.action?.branch.name ?? 'main'
                }`,
        )
    }
    log(chalk.blue(`  Cancelled: ${CANCELLED?.length ?? 0}`))
    for (const repo of CANCELLED ?? []) {
        log(
            chalk.blue(`   ${repo.name}`) +
                `: https://github.com/navikt/${repo.name}/actions?query=branch%3A${repo.action?.branch.name ?? 'main'}`,
        )
    }

    if (Object.keys(rest).length > 0) {
        const categoryPairs = Object.entries(rest)
        const categories = categoryPairs.map(([key, value]) => `${key}: ${value.length}`)
        log(chalk.yellow(`\tOthers states: ${categories.join(', ')}`))
    }
}
