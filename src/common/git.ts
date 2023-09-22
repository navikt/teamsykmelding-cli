import fs from 'node:fs'
import path from 'node:path'
import simpleGit, { CleanOptions, ResetMode, SimpleGit } from 'simple-git'
import { GIT_CACHE_DIR } from './cache.ts'
import chalk, { colorNames } from 'chalk'
import { logProgressDot } from './log.ts'

type GitterType = 'cache' | { type: 'user-config'; dir: string }

export class Gitter {
    private readonly type: GitterType
    private readonly git: SimpleGit

    constructor(type: GitterType) {
        this.type = type
        if (type === 'cache') {
            fs.mkdirSync(GIT_CACHE_DIR, { recursive: true })

            this.git = simpleGit({
                baseDir: GIT_CACHE_DIR,
                binary: 'git',
                maxConcurrentProcesses: 10,
            })
        } else {
            this.git = simpleGit({
                baseDir: type.dir,
                binary: 'git',
                maxConcurrentProcesses: 10,
            })
        }
    }

    public async cloneOrPull(
        repo: string,
        defaultBranch: string,
        silent = false,
        shallow = false,
    ): Promise<'updated' | 'cloned' | { type: 'error'; message: string }> {
        return this.exists(repo) ? this.pull(repo, defaultBranch, silent) : this.clone(repo, silent, shallow)
    }

    private async pull(
        repo: string,
        defaultBranch: string,
        silent: boolean,
    ): Promise<'updated' | { type: 'error'; message: string }> {
        logProgressDot()
        const t1 = performance.now()
        const repoClient = this.createRepoGitClient(repo)

        if (this.type === 'cache') {
            repoClient.reset(ResetMode.HARD).clean([CleanOptions.FORCE, CleanOptions.RECURSIVE]).pull({
                '--rebase': null,
            })
        } else {
            try {
                const currentBranch = await repoClient.revparse(['--abbrev-ref', 'HEAD'])
                if (currentBranch.trim() === defaultBranch) {
                    await repoClient.pull({ '--rebase': null })
                } else {
                    await repoClient.fetch('origin', `${defaultBranch}:${defaultBranch}`)
                }
            } catch (e) {
                return {
                    type: 'error',
                    message: (e as Error).message,
                }
            }
        }

        if (!silent) {
            console.info(`${repo}, exists, pulled OK (${Math.round(performance.now() - t1)}ms)`)
        }

        logProgressDot()
        return 'updated'
    }

    private async clone(repo: string, silent: boolean, shallow: boolean): Promise<'cloned'> {
        const remote = `git@github.com:navikt/${repo}.git`

        logProgressDot()
        const t1 = performance.now()
        await this.git.clone(remote, repo, shallow ? { '--depth': 1 } : undefined)

        if (!silent) {
            console.info(`Cloned ${repo}${shallow ? ' (shallow)' : ''} OK (${Math.round(performance.now() - t1)}ms))`)
        }

        logProgressDot()
        return 'cloned'
    }

    private createRepoGitClient(repo: string): SimpleGit {
        if (this.type === 'cache') {
            return simpleGit({
                baseDir: `${GIT_CACHE_DIR}/${repo}`,
                binary: 'git',
                maxConcurrentProcesses: 1,
            })
        } else {
            return simpleGit({
                baseDir: `${this.type.dir}/${repo}`,
                binary: 'git',
                maxConcurrentProcesses: 1,
            })
        }
    }

    private exists(repo: string): boolean {
        if (this.type === 'cache') {
            return fs.existsSync(path.join(GIT_CACHE_DIR, repo))
        } else {
            return fs.existsSync(path.join(this.type.dir, repo))
        }
    }
}
