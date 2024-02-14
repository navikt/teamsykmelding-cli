import chalk from 'chalk'

import { log } from './common/log.ts'
import { getTeamsCache } from './common/cache/team.ts'
import inquirer from './common/inquirer.ts'
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

    const teamResponse = await inquirer.prompt<{ team: string }>({
        type: 'list',
        name: 'team',
        message: 'Change team context to',
        choices: teams,
    })
    const clusterResponse = await inquirer.prompt<{ cluster: 'dev-gcp' | 'prod-gcp' }>({
        type: 'list',
        name: 'cluster',
        message: 'Which cluster?',
        choices: ['dev-gcp', 'prod-gcp'],
    })

    log('')
    await updateConfig({ team: teamResponse.team })
    await changeContext(teamResponse.team, clusterResponse.cluster)

    log(`→ tsm team switched to ${chalk.green(teamResponse.team)}`)
}
