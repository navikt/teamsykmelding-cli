import path from 'node:path'
import fs from 'node:fs'
import * as child_process from 'child_process'

import chalk from 'chalk'

import { getConfig } from '../common/config.ts'
import { log, logError } from '../common/log.ts'
import inquirer from '../common/inquirer.ts'

async function openProject(projectDir: string): Promise<void> {
    const absolutePath: string = path.resolve(projectDir)
    const config = await getConfig()

    const command: string = `${config.ide} ${absolutePath}`

    child_process.exec(command, (error) => {
        if (error) {
            logError(`Could not open project: ${error.message}`)
            return
        }
    })
}
export async function open(projectDir: string | undefined | null): Promise<void> {
    const config = await getConfig()
    log(`projectDir is ${projectDir}`)
    if (config.gitDir == null) {
        log(`${chalk.red('Git dir not set, run: ')}${chalk.yellow('tsm config --git-dir=<dir>')}`)
        process.exit(1)
    }

    const files = fs.readdirSync(config.gitDir)
    const myInput = projectDir || ''
    const response = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'selectedFile',
            message: 'Start typing to search for a directory',
            source: function (_: unknown, input: string) {
                return new Promise(function (resolve) {
                    const results = files.filter((file) => file.includes(input || myInput))
                    resolve(results)
                })
            },
        },
    ])

    projectDir = response.selectedFile
    if (!projectDir) {
        log('No project selected')
        process.exit(1)
    }
    const absolutePath = path.resolve(config.gitDir, projectDir)
    if (fs.existsSync(absolutePath)) {
        log(`Opening ${absolutePath} in IDE...`)
        await openProject(absolutePath)
    } else {
        log(`The path ${absolutePath} doesn't exist.`)
    }
}
