import * as R from 'remeda'
import { parseISO } from 'date-fns'
import {BaseRepoNodeFragment, ghGqlQuery, OrgTeamRepoResult, removeIgnoredAndArchived} from '../common/octokit.ts'
import { log } from '../common/log.ts'
import chalk, { backgroundColorNames } from 'chalk'
import { blacklisted } from '../common/repos.ts'
import { coloredTimestamp } from '../common/date-utils.ts'
import * as crypto from 'crypto'

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

type PullRequestNode = {
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
                        ...BaseRepoNode
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

    ${BaseRepoNodeFragment}
`

async function getPrs(team: string, includeDrafts = false): Promise<Record<string, PrNode[]>> {
    log(chalk.green(`Getting all open prs for team ${team}${includeDrafts ? ' (including drafts)' : ''}`))

    const queryResult = await ghGqlQuery<OrgTeamRepoResult<PullRequestNode>>(reposQuery, { team })

    const openPrs = R.pipe(
        queryResult.organization.team.repositories.nodes,
        removeIgnoredAndArchived,
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

function authorToColorAvatar(username: string) {
    const index =
        parseInt(crypto.createHash('md5').update(username).digest('hex').slice(-6), 16) % backgroundColorNames.length

    return chalk[backgroundColorNames[index]]('  ')
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
                    `\t${pr.title} (${pr.permalink})\n\tBy ${authorToColorAvatar(pr.author.login)} ${
                        pr.author.login
                    } ${coloredTimestamp(parseISO(pr.updatedAt))} ago${pr.isDraft ? ' (draft)' : ''}`,
                )
            })
        }),
    )
}
