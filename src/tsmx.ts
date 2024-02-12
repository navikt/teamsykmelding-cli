import chalk from 'chalk'

import { log } from './common/log.ts'
import { getTeamsCache } from './common/cache/team.ts'
import inquirer from './common/inquirer.ts'
import { updateConfig } from './common/config.ts'

/**
 * Interactive team-switcher
 */
export async function tsmx(): Promise<void> {
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

    await updateConfig({ team: teamResponse.team })

    log(chalk.green(`Team set to ${teamResponse.team}`))
}
