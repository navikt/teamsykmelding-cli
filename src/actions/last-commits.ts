import * as R from 'remeda'
import { parseISO, subMonths } from 'date-fns'
import { octokit } from '../common/octokit.ts'

type RepoNodes = {
    name: string
    isArchived: boolean
    pushedAt: string
    url: string
    defaultBranchRef: {
        target: {
            message: string
            checkSuites: {
                nodes: {
                    status: string
                    conclusion: string
                }[]
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
): Promise<{ name: string; lastPush: Date; commit: string; status: string }[]> {
    console.info(`Getting repositories for team ${team}`)

    const queryResult = (await octokit.graphql(getTeamReposQuery, {
        team,
    })) as any

    const threeMonthsAgo = subMonths(new Date(), 3)
    const repos = R.pipe(
        queryResult.organization.team.repositories.nodes as RepoNodes[],
        R.filter((it) => !it.isArchived),
        R.map((repo) => ({
            name: repo.name,
            lastPush: parseISO(repo.pushedAt),
            commit: repo.defaultBranchRef.target.message,
            status: repo.defaultBranchRef.target.checkSuites.nodes[0].status,
        })),
        R.sortBy((it) => it.lastPush),
        R.reverse(),
    )

    console.info(`Got ${repos.length} repositories for team ${team}`)

    return repos
}

const lastCommits = await getRepositories('teamsykmelding')

console.log(
    lastCommits
        .map((it) => `${it.status}: ${it.name} (${it.lastPush.toISOString()}): ${it.commit.split('\n')[0]}`)
        .join('\n'),
)
