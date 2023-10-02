import * as R from 'remeda'
import chalk from 'chalk'
import { BaseRepoNodeFragment, ghGqlQuery, OrgTeamRepoResult, removeIgnoredAndArchived } from '../common/octokit.ts'
import { log } from '../common/log.ts'

const reposQuery = /* GraphQL */ `
    query OurRepos($team: String!) {
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

async function getMainBranchPerRepo(team: string): Promise<[string, string][]> {
    log(chalk.green(`Getting all main branch for repos in team ${team}`))

    const queryResult = await ghGqlQuery<OrgTeamRepoResult<unknown>>(reposQuery, { team })

    return R.pipe(
        queryResult.organization.team.repositories.nodes,
        removeIgnoredAndArchived,
        R.map((repo) => [repo.name, repo.defaultBranchRef.name]),
    )
}

export async function getRepoMainBranch(showMain: boolean): Promise<void> {
    const openPrs = await getMainBranchPerRepo('teamsykmelding')
    const notMain = openPrs.filter(([, mainbranch]) => mainbranch !== 'main').length

    if (!showMain && notMain === 0) {
        log(chalk.green(`\nAll repos are on main!! :)\n`))
        return
    }

    log(`\nFound ${chalk.greenBright(openPrs.length)} repos in total, ${chalk.red(notMain)} that are not 'main'\n`)
    R.pipe(
        openPrs,
        showMain ? (it) => it : R.filter(([, branch]) => branch !== 'main'),
        R.forEach(([repo, mainbranch]) => {
            log(`${chalk.greenBright(repo)}: ${mainbranch !== 'main' ? chalk.redBright(mainbranch) : mainbranch}`)
        }),
    )
}
