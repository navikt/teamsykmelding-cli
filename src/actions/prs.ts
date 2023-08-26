import * as R from 'remeda'
import { parseISO } from 'date-fns'
import { getOctokitClient } from '../common/octokit.ts'
import { log } from '../common/log.ts'
import chalk, { backgroundColorNames } from 'chalk'
import { blacklisted } from '../common/repos.ts'
import { coloredTimestamp } from '../common/date-utils.ts'
import * as crypto from 'crypto'
import terminalImage from 'terminal-image'
import * as buffer from 'buffer'

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

function authorToColorAvatar(username: string) {
    const index =
        parseInt(crypto.createHash('md5').update(username).digest('hex').slice(-6), 16) % backgroundColorNames.length

    return chalk[backgroundColorNames[index]]('  ')
}

async function fetchToBuffer(url: string): Promise<string> {
    const arrayBuffer = await fetch(url).then((it) => it.arrayBuffer())

    return terminalImage.buffer(Buffer.from(arrayBuffer), { height: 2, width: 2 })
}

export async function openPrs(includeDrafts: boolean): Promise<void> {
    const openPrs = await getPrs('teamsykmelding', includeDrafts)

    const avatarTuples = await R.pipe(
        openPrs,
        R.values,
        R.flatten(),
        R.map(async (it): Promise<[string, string]> => [it.author.login, await fetchToBuffer(it.author.avatarUrl)]),
        (it) => Promise.all(it),
    )
    const avatarLookup = R.fromPairs(avatarTuples)

    R.pipe(
        openPrs,
        R.toPairs,
        R.sortBy([([, prs]) => R.first(prs)?.updatedAt ?? '', 'desc']),
        R.forEach(([repo, prs]) => {
            log(chalk.greenBright(repo))
            prs.forEach((pr) => {
                log(
                    `\t${pr.title} (${pr.permalink})\n\t${coloredTimestamp(parseISO(pr.updatedAt))} ago by ${
                        pr.author.login
                    } ${avatarLookup[pr.author.login] ?? authorToColorAvatar(pr.author.login)} ${
                        pr.isDraft ? ' (draft)' : ''
                    }`,
                )
            })
        }),
    )
}
