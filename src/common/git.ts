import fs from 'node:fs'
import path from 'node:path'
import simpleGit, { CleanOptions, ResetMode, SimpleGit } from 'simple-git'

export const GIT_DIR = path.join(Bun.env.HOME ?? '~', '.cache', 'tsm', 'repos')

fs.mkdirSync(GIT_DIR, { recursive: true })
const git = simpleGit({
    baseDir: GIT_DIR,
    binary: 'git',
    maxConcurrentProcesses: 10,
})

export async function cloneOrPull(repo: string, silent = false): Promise<'updated' | 'cloned'> {
    return exists(repo) ? pull(repo, silent) : clone(repo, silent)
}

export function createRepoGitClient(repo: string): SimpleGit {
    return simpleGit({
        baseDir: `${GIT_DIR}/${repo}`,
        binary: 'git',
        maxConcurrentProcesses: 1,
    })
}

async function pull(repo: string, silent: boolean): Promise<'updated'> {
    const t1 = performance.now()
    await createRepoGitClient(repo).reset(ResetMode.HARD).clean([CleanOptions.FORCE, CleanOptions.RECURSIVE]).pull({
        '--rebase': null,
    })

    if (!silent) {
        console.info(`${repo}, exists, pulled OK (${Math.round(performance.now() - t1)}ms)`)
    }

    return 'updated'
}

async function clone(repo: string, silent: boolean): Promise<'cloned'> {
    const remote = `git@github.com:navikt/${repo}.git`

    const t1 = performance.now()
    await git.clone(remote, repo, { '--depth': 1 })

    if (!silent) {
        console.info(`Cloned ${repo} OK (${Math.round(performance.now() - t1)}ms))`)
    }

    return 'cloned'
}

function exists(repo: string): boolean {
    return fs.existsSync(path.join(GIT_DIR, repo))
}
