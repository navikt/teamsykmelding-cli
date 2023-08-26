import { Octokit } from 'octokit'

if (!Bun.env.READER_TOKEN) {
    console.error('READER_TOKEN is not set')
    process.exit(1)
}

export const octokit = new Octokit({
    auth: Bun.env.READER_TOKEN,
})

const blacklist: string[] = ['vault-iac']

export function blacklisted<Repo extends { name: string }>(repo: Repo): boolean {
    return !blacklist.includes(repo.name)
}
