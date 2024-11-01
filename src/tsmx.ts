import chalk from 'chalk'
import { select } from '@inquirer/prompts'

import { log } from './common/log.ts'
import { getTeamsCache } from './common/cache/team.ts'
import { updateConfig } from './common/config.ts'
import { updateAnalytics } from './analytics'
import { changeContext } from './common/kubectl.ts'

/**
 * Interactive team-switcher
 */
export async function tsmx(): Promise<void> {
    updateAnalytics(['tsmx'])

    const teams = await getTeamsCache()

    if (teams.length === 0) {
        log(chalk.red('No teams found!'))
        log(chalk.blueBright('Please configure a team with:'))
        log(chalk.blueBright('tsm config --team=<team-name>'))
        return
    }

    if (teams.length === 1) {
        log(chalk.yellow(`Only one team found (${teams[0]})!`))
        log(chalk.blueBright('Add another team with:'))
        log(chalk.blueBright('tsm config --team=<team-name>'))
        return
    }

    const teamResponse = await select({
        message: 'Change team context to',
        choices: teams.map((team) => ({ name: team, value: team })),
    })

    const clusterResponse = await select<'dev-gcp' | 'prod-gcp'>({
        message: 'Which cluster?',
        choices: [
            { name: 'dev-gcp', value: 'dev-gcp' },
            { name: 'prod-gcp', value: 'prod-gcp' },
        ] as const,
    })

    log('')
    await updateConfig({ team: teamResponse })
    await changeContext(teamResponse, clusterResponse)

    log(`→ tsm team switched to ${chalk.green(teamResponse)}`)
}
