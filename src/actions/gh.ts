import path from 'node:path'

import chalk from 'chalk'

import { BaseRepoNodeFragment, ghGqlQuery, OrgTeamRepoResult } from '../common/octokit.ts'
import inquirer from '../common/inquirer.ts'
import { CACHE_DIR } from '../common/cache.ts'
import { log, logError } from '../common/log.ts'
import { getTeam } from '../common/config.ts'
import { openUrl } from '../common/open-url.ts'

const reposForTeamQuery = /* GraphQL */ `
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

export async function openRepoWeb(search: string | null, noCache: true | undefined): Promise<void> {
    const repos = await getRepos(!noCache)

    const perfectMatch = repos.find((it) => it === search)
    if (perfectMatch != null) {
        await openRepo(perfectMatch)
        return
    }

    const initialFilter = repos.filter((name) => name.includes(search ?? ''))
    if (initialFilter.length === 1) {
        await openRepo(initialFilter[0])
        return
    }

    const { item } = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'item',
            message: 'Which repo do you want to open in browser?',
            source: async (_: unknown, input: string) => repos.filter((name) => name.includes(input ?? search ?? '')),
        },
    ])

    await openRepo(item)
}

async function getRepos(cache: boolean = true): Promise<string[]> {
    if (!cache) {
        return await fetchRepos().then((repos) => {
            saveCachedRepos(repos)

            return repos
        })
    }

    upgradeCacheInBackground()

    const cachedRepos = await loadCachedRepos()
    if (cachedRepos.length > 0) return cachedRepos

    log(chalk.blueBright('No cached repos found, fetching and populating cache... Next time will be faster :-)'))
    return await fetchRepos().then((repos) => {
        saveCachedRepos(repos)

        return repos
    })
}

function upgradeCacheInBackground(): void {
    fetchRepos().then((repos) => saveCachedRepos(repos))
}

async function fetchRepos(): Promise<string[]> {
    const team = await getTeam()

    const queryResult = await ghGqlQuery<OrgTeamRepoResult<unknown>>(reposForTeamQuery, {
        team,
    })

    return queryResult.organization.team.repositories.nodes.map((it) => it.name)
}

async function loadCachedRepos(): Promise<string[]> {
    try {
        const team = await getTeam()
        const cachedRepos = Bun.file(path.join(CACHE_DIR, `repos-${team}.json`))
        if (!(await cachedRepos.exists())) return []

        return await cachedRepos.json()
    } catch (e) {
        logError('Error loading cached repos', e)
        return []
    }
}

async function saveCachedRepos(repos: string[]): Promise<void> {
    const team = await getTeam()
    const cachedRepos = Bun.file(path.join(CACHE_DIR, `repos-${team}.json`))
    await Bun.write(cachedRepos, JSON.stringify(repos))
}

async function openRepo(repo: string): Promise<void> {
    log(`Opening ${chalk.green(`${repo} on github.com...`)}`)
    await openUrl(`https://github.com/navikt/${repo}`)
}
