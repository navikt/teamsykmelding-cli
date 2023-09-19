import * as path from 'node:path'
import * as fs from 'node:fs'
import { parse } from 'semver'
import chalk from 'chalk'

import packageJson from '../tsm-cli/package.json'

import { log } from './common/log.ts'

const cacheDir = path.join(Bun.env.HOME ?? '~', '.cache', 'tsm')

export function hasNewVersion(): string | null {
    const sub = Bun.spawnSync('npm view @navikt/teamsykmelding-cli@latest versions --json'.split(' '))
    const result = JSON.parse(sub.stdout.toString()).at(-1)

    if (!parse(result)) {
        throw new Error(`Could not parse version ${result}`)
    }

    return result !== packageJson.version ? result : null
}

export function updateToNewestVersion(): void {
    const newVersion = hasNewVersion()
    if (newVersion != null) {
        log(`Updating to ${chalk.green(newVersion)}...`)
        const updateSub = Bun.spawnSync('npm i -g @navikt/teamsykmelding-cli'.split(' '))
        if (updateSub.exitCode === 0) {
            log(chalk.green(`Updated to version ${newVersion}!`))
        } else {
            log(chalk.bgWhite.red(`Could not update to version ${newVersion}.`))
            log(chalk.red(updateSub.stderr.toString()))

            process.exit(1)
        }
        fs.rmSync(path.join(cacheDir, 'metadata.json'))
    } else {
        log(chalk.green(`You are on the latest version!`))
    }
}

export async function hasNewVersionCached(): Promise<string | null> {
    const versionFile = Bun.file(path.join(cacheDir, 'metadata.json'))
    if (!(await versionFile.exists())) return null

    const file = await versionFile.json()
    return file?.newVersion !== packageJson.version ? file.newVersion : null
}

export async function writeNewVersionCache(version: string) {
    fs.mkdirSync(cacheDir, { recursive: true })
    await Bun.write(path.join(cacheDir, 'metadata.json'), JSON.stringify({ newVersion: version }))
}

export async function unsetNewVersionCache() {
    fs.rmSync(path.join(cacheDir, 'metadata.json'))
}

if (Bun.argv.find((it) => it.includes('self-updater.ts'))) {
    const newVersion = await hasNewVersion()
    if (newVersion != null) {
        await writeNewVersionCache(newVersion)
    } else {
        await unsetNewVersionCache()
    }
}
