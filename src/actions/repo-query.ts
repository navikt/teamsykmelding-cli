import * as R from 'remeda'
import chalk from 'chalk'

import {
    BaseRepoNode,
    BaseRepoNodeFragment,
    ghGqlQuery,
    OrgTeamRepoResult,
    removeIgnoredAndArchived,
} from '../common/octokit.ts'
import { Gitter } from '../common/git.ts'
import { log } from '../common/log.ts'
import { GIT_CACHE_DIR } from '../common/cache.ts'

const reposQuery = /* GraphQL */ `
    query ($team: String!) {
        organization(login: "navikt") {
            team(slug: $team) {
                repositories(orderBy: { field: PUSHED_AT, direction: DESC }) {
                    nodes {
                        ...BaseRepoNode
                    }
                }
            }
        }
    }

    ${BaseRepoNodeFragment}
`

async function getAllRepos(): Promise<BaseRepoNode<unknown>[]> {
    log(chalk.green(`Getting all active repositories for team teamsykmelding...`))

    const result = await ghGqlQuery<OrgTeamRepoResult<unknown>>(reposQuery, {
        team: 'teamsykmelding',
    })

    return removeIgnoredAndArchived(result.organization.team.repositories.nodes)
}

async function cloneAllRepos(): Promise<BaseRepoNode<unknown>[]> {
    const gitter = new Gitter('cache')
    const repos = await getAllRepos()
    const results = await Promise.all(
        repos.map((it) => gitter.cloneOrPull(it.name, it.defaultBranchRef.name, true, true)),
    )

    log(
        `Updated ${chalk.yellow(results.filter((it) => it === 'updated').length)} and cloned ${chalk.yellow(
            results.filter((it) => it === 'cloned').length,
        )} repos`,
    )

    return repos
}

function queryRepo(query: string, repo: string): boolean {
    const result = Bun.spawnSync(query.split(' '), {
        cwd: `${GIT_CACHE_DIR}/${repo}`,
    })

    return result.exitCode === 0
}

export async function queryForRelevantRepos(query: string): Promise<void> {
    const repos = await cloneAllRepos()

    if (!query) {
        throw new Error('Missing query')
    }

    const relevantRepos = R.pipe(
        repos,
        R.map((it) => [it, queryRepo(query, it.name)] as const),
        R.filter(([, result]) => result),
        R.map(([name]) => name),
    )

    log(`The following ${chalk.green('repos')} match the query ${chalk.yellow(query)}:`)
    log(relevantRepos.map((it) => ` - ${it.name} (${it.url})`).join('\n'))
}
