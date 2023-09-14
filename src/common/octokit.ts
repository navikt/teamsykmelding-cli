import { Octokit } from 'octokit'
import chalk from 'chalk'
import * as R from 'remeda'

import { log } from './log.ts'
import { blacklisted } from './repos.ts'

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

type OrgTeamResult<Result> = {
    organization: {
        team: Result
    }
}

type BaseRepoNode<AdditionalRepoProps> = {
    name: string
    isArchived: boolean
    pushedAt: string
    url: string
} & AdditionalRepoProps

export type OrgTeamRepoResult<AdditionalRepoProps> = OrgTeamResult<{
    repositories: {
        nodes: BaseRepoNode<AdditionalRepoProps>[]
    }
}>

export const removeIgnored: <AdditionalRepoProps>(
    nodes: BaseRepoNode<AdditionalRepoProps>[],
) => BaseRepoNode<AdditionalRepoProps>[] = R.createPipe(
    R.filter((it) => !it.isArchived),
    R.filter(blacklisted),
)
