import chalk from 'chalk'
import * as R from 'remeda'
import { parseISO } from 'date-fns'

import { log } from '../../common/log.ts'
import { getTeam } from '../../common/config.ts'
import { coloredTimestamp } from '../../common/date-utils.ts'

import { getReposByState } from './data.ts'

export async function checkBuilds(): Promise<void> {
    const team = await getTeam()
    log(chalk.green(`Checking build status for all ${team} repos... \t`))

    const reposByState = await getReposByState(team)

    const { SUCCESS, FAILURE, CANCELLED, ...rest } = reposByState

    log(`Found ${R.pipe(reposByState, R.toPairs, R.flatMap(R.last), R.length)} repos with build status`)
    log(chalk.green(`  Success: ${SUCCESS?.length ?? 0} repos`))
    log(chalk.red(`  Failure: ${FAILURE?.length ?? 0}`))
    for (const repo of FAILURE ?? []) {
        log(
            chalk.red(
                `   ${repo.name} failed ${
                    repo.action?.workflowRun?.updatedAt != null
                        ? coloredTimestamp(parseISO(repo.action.workflowRun.updatedAt))
                        : 'dunno lol'
                } ago`,
            ) +
                `\n\tActions: https://github.com/navikt/${repo.name}/actions?query=branch%3A${
                    repo.action?.branch.name ?? 'main'
                }`,
        )
    }
    log(chalk.blue(`  Cancelled: ${CANCELLED?.length ?? 0}`))
    for (const repo of CANCELLED ?? []) {
        log(
            chalk.blue(`   ${repo.name}`) +
                `: https://github.com/navikt/${repo.name}/actions?query=branch%3A${repo.action?.branch.name ?? 'main'}`,
        )
    }

    if (Object.keys(rest).length > 0) {
        const categoryPairs = Object.entries(rest)
        const categories = categoryPairs.map(([key, value]) => `${key}: ${value.length}`)
        log(chalk.yellow(`  Others states: ${categories.join(', ')}`))
        for (const [key, value] of categoryPairs) {
            for (const repo of value) {
                log(
                    `    ${key}: ` +
                        chalk.yellow(`${repo.name}`) +
                        `: https://github.com/navikt/${repo.name}/actions?query=branch%3A${
                            repo.action?.branch.name ?? 'main'
                        }`,
                )
            }
        }
    }
}
