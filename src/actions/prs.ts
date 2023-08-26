import * as R from 'remeda'
import { parseISO } from 'date-fns'
import { getOctokitClient } from '../common/octokit.ts'
import { log } from '../common/log.ts'
import chalk from 'chalk'
import { blacklisted } from '../common/repos.ts'
import { coloredTimestamp } from '../common/date-utils.ts'

type PrNode = {
    title: string
    updatedAt: string
    permalink: string
    isDraft: boolean
    author: {
        avatarUrl: string
        login: string
    }
}

type RepoNodes = {
    name: string
    isArchived: boolean
    pushedAt: string
    url: string
    pullRequests: {
        nodes: PrNode[]
    }
}

const reposQuery = /* GraphQL */ `
    query OurRepos($team: String!) {
        organization(login: "navikt") {
            team(slug: $team) {
                repositories(orderBy: { field: PUSHED_AT, direction: ASC }) {
                    nodes {
                        name
                        isArchived
                        pushedAt
                        url
                        pullRequests(first: 10, orderBy: { field: UPDATED_AT, direction: DESC }, states: OPEN) {
                            nodes {
                                title
                                updatedAt
                                permalink
                                isDraft
                                author {
                                    avatarUrl
                                    login
                                }
                            }
                        }
                    }
                }
            }
        }
    }
`

async function getPrs(team: string, includeDrafts = false): Promise<Record<string, PrNode[]>> {
    log(chalk.green(`Getting all open prs for team ${team}${includeDrafts ? ' (including drafts)' : ''}`))

    const queryResult = (await getOctokitClient().graphql(reposQuery, { team })) as any

    const openPrs = R.pipe(
        queryResult.organization.team.repositories.nodes as RepoNodes[],
        R.filter((it) => !it.isArchived),
        R.filter(blacklisted),
        R.flatMap((repo) =>
            R.pipe(
                repo.pullRequests.nodes,
                R.map((pr): [string, PrNode] => [repo.name, pr]),
                R.sortBy(([, pr]) => pr.updatedAt),
                R.filter(([, pr]) => includeDrafts || !pr.isDraft),
            ),
        ),
        R.groupBy(([repo]) => repo),
        R.mapValues((value) => value.map((it) => it[1])),
    )

    log(`Found ${chalk.greenBright(Object.values(openPrs).flat().length)} open prs for team ${team}\n`)

    return openPrs
}

export async function openPrs(includeDrafts: boolean): Promise<void> {
    const openPrs = await getPrs('teamsykmelding', includeDrafts)

    R.pipe(
        openPrs,
        R.toPairs,
        R.sortBy([([, prs]) => R.first(prs)?.updatedAt ?? '', 'desc']),
        R.forEach(([repo, prs]) => {
            log(chalk.greenBright(repo))
            prs.forEach((pr) => {
                log(
                    `\t${pr.title} (${pr.permalink})\n\tBy ${pr.author.login} ${coloredTimestamp(
                        parseISO(pr.updatedAt),
                    )} ago${pr.isDraft ? ' (draft)' : ''}`,
                )
            })
        }),
    )
}
