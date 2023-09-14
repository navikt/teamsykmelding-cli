import * as R from 'remeda'
import chalk from 'chalk'
import { ghGqlQuery, OrgTeamRepoResult, OrgTeamResult, removeIgnoredAndArchived } from '../common/octokit.ts'
import { log } from '../common/log.ts'
import { authorToColorAvatar } from '../common/format-utils.ts'

type MemberNodes = {
    members: {
        nodes: {
            login: string
            name: string
            avatarUrl: string
        }[]
    }
}

const reposQuery = /* GraphQL */ `
    query TeamMembers($team: String!) {
        organization(login: "navikt") {
            team(slug: $team) {
                members {
                    nodes {
                        login
                        name
                        avatarUrl
                    }
                }
            }
        }
    }
`

export async function displayMembers(): Promise<void> {
    const team = 'teamsykmelding'

    log(chalk.green(`Getting team members for team ${team}`))

    const queryResult = await ghGqlQuery<OrgTeamResult<MemberNodes>>(reposQuery, { team })
    const members = queryResult.organization.team.members.nodes

    log(`Found ${chalk.greenBright(members.length)} members in team ${team}!`)

    R.pipe(
        members,
        R.forEach((it) => {
            log(
                `  ${authorToColorAvatar(it.login)} ${
                    it.name ? `${it.name} (${chalk.greenBright(it.login)})` : chalk.greenBright(it.login)
                } - ${chalk.blueBright(`https://github.com/${it.login}`)}`,
            )
        }),
    )
}
