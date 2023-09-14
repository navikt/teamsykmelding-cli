import * as R from 'remeda'
import { getOctokitClient } from '../common/octokit.ts'
import { log } from '../common/log.ts'
import chalk, { backgroundColorNames } from 'chalk'
import { blacklisted } from '../common/repos.ts'
import * as crypto from 'crypto'

type CheckSuite = {
    branch: {
        name: string
    } | null
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
                        defaultBranchRef {
                            target {
                                ... on Commit {
                                    message
                                    checkSuites(last: 1) {
                                        nodes {
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

async function getMainBranchPerRepo(team: string): Promise<[string, string][]> {
    log(chalk.green(`Getting all main branch for repos in team ${team}`))

    const queryResult = (await getOctokitClient().graphql(reposQuery, { team })) as any

    return R.pipe(
        queryResult.organization.team.repositories.nodes as RepoNodes[],
        R.filter((it) => !it.isArchived),
        R.filter(blacklisted),
        R.flatMap((repo) =>
            repo.defaultBranchRef.target.checkSuites.nodes.map((it: CheckSuite): [string, string] => [
                repo.name,
                it.branch?.name ?? 'no primary branch configured',
            ]),
        ),
    )
}

export async function getRepoMainBranch(showMain: boolean): Promise<void> {
    const openPrs = await getMainBranchPerRepo('teamsykmelding')
    const notMain = openPrs.filter(([, mainbranch]) => mainbranch !== 'main').length

    log(`\nFound ${chalk.greenBright(openPrs.length)} repos in total, ${chalk.red(notMain)} that are not 'main'\n`)
    R.pipe(
        openPrs,
        showMain ? (it) => it : R.filter(([, branch]) => branch !== 'main'),
        R.forEach(([repo, mainbranch]) => {
            log(`${chalk.greenBright(repo)}: ${mainbranch !== 'main' ? chalk.redBright(mainbranch) : mainbranch}`)
        }),
    )
}
