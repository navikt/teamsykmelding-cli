import * as R from 'remeda'
import { add, endOfDay, formatISO, startOfDay } from 'date-fns'
import chalk from 'chalk'

import { BaseRepoNodeFragment, ghGqlQuery, OrgTeamRepoResult, removeIgnoredAndArchived } from '../../common/octokit.ts'
import { log } from '../../common/log.ts'
import { humanDay } from '../../common/date-utils.ts'
import { authorToColorAvatar } from '../../common/format-utils.ts'

type CommitsInRangeNode = {
    defaultBranchRef: {
        target: {
            history: {
                nodes: {
                    message: string
                    author: {
                        date: string
                        email: string
                        name: string
                        user: {
                            name: string
                            login: string
                        }
                    }
                }[]
            }
        }
    }
}

const commitsInRangeQuery = /* GraphQL */ `
    query OurRepos($team: String!, $fom: GitTimestamp!, $tom: GitTimestamp!) {
        organization(login: "navikt") {
            team(slug: $team) {
                repositories(orderBy: { field: PUSHED_AT, direction: DESC }, first: 100) {
                    nodes {
                        ...BaseRepoNode
                        defaultBranchRef {
                            target {
                                ... on Commit {
                                    history(since: $fom, until: $tom, first: 100) {
                                        nodes {
                                            message
                                            author {
                                                date
                                                email
                                                name
                                                user {
                                                    name
                                                    login
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
    }

    ${BaseRepoNodeFragment}
`

export async function displayCommitsForPeriod(
    fom: Date,
    days: number,
    includeUncategorizeable: boolean,
    author: string | null,
): Promise<void> {
    const team = 'teamsykmelding'
    const fomDate = formatISO(startOfDay(fom))
    const tomDate = formatISO(endOfDay(add(fom, { days })))

    log(
        chalk.green(
            `Getting commits for team ${team} from ${humanDay(fomDate)} to ${humanDay(tomDate)}${
                author != null ? ` for author ${author}` : ''
            }\n`,
        ),
    )

    const queryResult = await ghGqlQuery<OrgTeamRepoResult<CommitsInRangeNode>>(commitsInRangeQuery, {
        team,
        fom: fomDate,
        tom: tomDate,
    })

    const result = R.pipe(
        queryResult.organization.team.repositories.nodes,
        removeIgnoredAndArchived,
        R.map((repo) => ({
            name: repo.name,
            commits: repo.defaultBranchRef.target.history.nodes.filter((it) => it.author.name !== 'dependabot[bot]'),
        })),
        R.filter((it) => it.commits.length > 0),
        R.flatMap((it) => it.commits.map((commit) => ({ repo: it.name, commit }))),
        R.map((commit) => ({
            ...commit,
            type: /^Merge pull request.*dependabot/g.test(commit.commit.message)
                ? 'dependabot-merge'
                : commit.commit.message.match(/^(\w+):/)?.[1] ?? 'unknown',
        })),
        (it) => {
            if (author == null) return it

            return R.filter(it, (it) => it.commit.author.user.login === author)
        },
        R.groupBy((it) => it.type),
    )

    const { feat, fix, chore, docs, automated, 'dependabot-merge': dependabotMerges, unknown, ...rest } = result
    const orderedCategories: typeof result = {
        feat: feat ?? [],
        fix: fix ?? [],
        chore: chore ?? [],
        docs: docs ?? [],
        ...rest,
    }

    for (const category in orderedCategories) {
        log(chalk.bold.bgBlueBright(category))
        if (orderedCategories[category].length === 0) {
            log(`  0 changes`)
            continue
        }

        for (const commit of orderedCategories[category]) {
            const cleanMessage = commit.commit.message
                .split('\n')[0]
                .replace(/^(\w+):/, '')
                .trim()

            log(`  ${cleanMessage} in ${chalk.green(commit.repo)}`)
        }
    }

    if (includeUncategorizeable && unknown?.length) {
        log(chalk.bold.bgBlueBright('unknown'))
        for (const commit of unknown) {
            const cleanMessage = commit.commit.message.split('\n')[0].trim()

            log(
                `  ${cleanMessage} in ${chalk.green(commit.repo)} (by ${authorToColorAvatar(
                    commit.commit.author.user.login,
                )} ${commit.commit.author.user.login})`,
            )
        }
    }

    if (automated || dependabotMerges || (unknown && !includeUncategorizeable)) log('\nThere were also:')
    if (automated) log(`  ${chalk.yellow(automated.length)} automated commits`)
    if (dependabotMerges) log(`  ${chalk.yellow(dependabotMerges.length)} dependabot merges`)
    if (unknown && !includeUncategorizeable) log(`  ${chalk.yellow(unknown.length)} commits of unknown type`)
}
