import * as R from 'remeda'
import { parseISO } from 'date-fns'

import { BaseRepoNodeFragment, ghGqlQuery, OrgTeamRepoResult, removeIgnoredAndArchived } from '../../common/octokit.ts'

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

export type ReposByState = Awaited<ReturnType<typeof getReposByState>>

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function getReposByState(team: string) {
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
    return reposByState
}
