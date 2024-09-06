import chalk from 'chalk'

import {
    BaseRepoNode,
    BaseRepoNodeFragment,
    ghGqlQuery,
    OrgTeamRepoResult,
    removeIgnoredAndArchived,
} from './octokit.ts'
import { log } from './log.ts'

const blacklist: string[] = ['vault-iac', 'omrade-helse-etterlevelse-topic']

export function blacklisted<Repo extends { name: string }>(repo: Repo): boolean {
    return !blacklist.includes(repo.name)
}

export async function getAllRepos(team: string): Promise<BaseRepoNode<unknown>[]> {
    log(chalk.green(`Getting all active repositories for team ${team}...`))

    const result = await ghGqlQuery<OrgTeamRepoResult<unknown>>(
        /* GraphQL */ `
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
        `,
        { team },
    )

    return removeIgnoredAndArchived(result.organization.team.repositories.nodes)
}
