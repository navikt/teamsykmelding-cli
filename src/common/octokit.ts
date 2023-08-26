import { Octokit } from 'octokit'
import { log } from './log.ts'
import chalk from 'chalk'

let octokit: Octokit | null = null
export function getOctokitClient(): Octokit {
    if (octokit === null) {
        octokit = new Octokit({ auth: getGithubCliToken() })
    }

    return octokit
}

function getGithubCliToken(): string {
    const subProcess = Bun.spawnSync('gh auth status --show-token'.split(' '))
    // gh-cli puts the token on stderr, probably because security
    const data: string | null = subProcess.stderr.toString().match(/Token: (.*)/)?.[1] ?? null

    if (!data?.trim()) {
        log(chalk.red(`Could not get github cli token. Please run 'gh auth login' and try again.`))
        process.exit(1)
    }

    return data
}
