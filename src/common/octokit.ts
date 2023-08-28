import { Octokit } from 'octokit'
import { log } from './log.ts'
import chalk from 'chalk'

let octokit: Octokit | null = null
export function getOctokitClient(auth: 'cli' | 'package' = 'cli'): Octokit {
    if (octokit === null) {
        octokit = new Octokit({ auth: auth === 'cli' ? getGithubCliToken() : Bun.env.NPM_AUTH_TOKEN })
    }

    return octokit
}

function getGithubCliToken(): string {
    const subProcess = Bun.spawnSync('gh auth status --show-token'.split(' '))
    const stdout = subProcess.stdout.toString()
    const stderr = subProcess.stderr.toString()

    // gh-cli puts the token on stderr, probably because security, but only on linux??? Lol
    const output = stdout.includes('Logged in to github.com') ? stdout : stderr
    const data: string | null = output.match(/Token: (.*)/)?.[1] ?? null

    if (!data?.trim()) {
        log(chalk.red(`Could not get github cli token. Please run 'gh auth login' and try again.`))
        process.exit(1)
    }

    return data
}
