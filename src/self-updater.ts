import * as path from 'node:path'
import * as fs from 'node:fs'

import * as R from 'remeda'
import { parse } from 'semver'
import chalk from 'chalk'

import packageJson from '../tsm-cli/package.json'

import { log } from './common/log.ts'
import { CACHE_DIR } from './common/cache.ts'

export function hasNewVersion(): string | null {
    const sub = Bun.spawnSync('npm view @navikt/teamsykmelding-cli@latest versions --json'.split(' '))
    const result = JSON.parse(sub.stdout.toString()).at(-1)

    if (!parse(result)) {
        throw new Error(`Could not parse version ${result}`)
    }

    return result !== packageJson.version ? result : null
}

export async function updateToNewestVersion(): Promise<void> {
    const newVersion = hasNewVersion()
    if (newVersion != null) {
        log(`Updating to ${chalk.green(newVersion)}...`)
        const updateSub = Bun.spawnSync('npm i -g @navikt/teamsykmelding-cli'.split(' '))
        if (updateSub.exitCode === 0) {
            log(chalk.green(`Updated to version ${newVersion}!`))
            reportChangesSinceLast(packageJson.version)
        } else {
            log(chalk.bgWhite.red(`Could not update to version ${newVersion}.`))
            log(chalk.red(updateSub.stderr.toString()))

            process.exit(1)
        }
        const metadataPath = path.join(CACHE_DIR, 'metadata.json')
        if (await Bun.file(metadataPath).exists()) {
            fs.rmSync(metadataPath)
        }
    } else {
        log(chalk.green(`You are on the latest version!`))
    }
}

export function reportChangesSinceLast(existingVersion: string): void {
    const hashMessageTuple: [string, string][] = Bun.spawnSync('git log -10 --format=%an;%s'.split(' '))
        .stdout.toString()
        .split('\n')
        .filter((it) => it)
        .map((it) => it.split(';') as [author: string, message: string])

    const changes = R.pipe(
        hashMessageTuple,
        R.splitWhen(([, message]) => message.includes(existingVersion)),
        R.first(),
        R.filter(([, message]) => !message.includes('bump version')),
    )

    if (changes && changes.length > 0) {
        log(chalk.green(`\nChanges since last version (${packageJson.version}):`))
        changes.forEach(([author, message]) =>
            log(chalk.yellowBright(`${message}\n\t${chalk.blueBright(`by ${author}`)}`)),
        )
    }
}

export async function hasNewVersionCached(): Promise<string | null> {
    const versionFile = Bun.file(path.join(CACHE_DIR, 'metadata.json'))
    if (!(await versionFile.exists())) return null

    const file = await versionFile.json()
    return file?.newVersion !== packageJson.version ? file.newVersion : null
}

export async function writeNewVersionCache(version: string): Promise<void> {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    await Bun.write(path.join(CACHE_DIR, 'metadata.json'), JSON.stringify({ newVersion: version }))
}

export async function unsetNewVersionCache(): Promise<void> {
    fs.rmSync(path.join(CACHE_DIR, 'metadata.json'))
}

if (Bun.argv.find((it) => it.includes('self-updater.ts'))) {
    const newVersion = hasNewVersion()
    if (newVersion != null) {
        await writeNewVersionCache(newVersion)
    } else {
        await unsetNewVersionCache()
    }
}
