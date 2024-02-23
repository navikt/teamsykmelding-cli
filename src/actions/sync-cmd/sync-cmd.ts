import chalk from 'chalk'
import * as R from 'remeda'
import { $ } from 'bun'
import { PushResult } from 'simple-git'

import { getAllRepos } from '../../common/repos.ts'
import { getTeam } from '../../common/config.ts'
import { Gitter } from '../../common/git.ts'
import { BaseRepoNode } from '../../common/octokit.ts'
import { log } from '../../common/log.ts'
import { GIT_CACHE_DIR } from '../../common/cache.ts'
import inquirer from '../../common/inquirer.ts'

export async function syncCmd(query: string | undefined, cmd: string | undefined, force: boolean): Promise<void> {
    if (query == null) {
        throw new Error('Missing query, use --query=...')
    }
    if (cmd == null) {
        throw new Error('Missing cmd, use --cmd=...')
    }

    const repos = await getAllRepos(await getTeam())
    await updateGitterCache(repos)

    const queriedRepos = await Promise.all(repos.map(async (it) => [it, await queryRepo(query, it.name)] as const))
    const relevantRepos = R.pipe(
        queriedRepos,
        R.filter(([, result]) => result),
        R.map(([name]) => name),
    )

    const targetRepos = await getTargetRepos(relevantRepos)

    const results = await runCommand(cmd, force, targetRepos[0], targetRepos.slice(1))

    log(
        `\n${chalk.green(results.filter(([, result]) => result === 'staged').length)} repos staged, ${chalk.red(
            results.filter(([, result]) => result === 'failed').length,
        )} failed, ${chalk.yellow(results.filter(([, result]) => result === 'dismissed').length)} dismissed\n`,
    )

    const stagedOnly = results.filter(([, result]) => result === 'staged').map(([name]) => name)
    const stagedRepos = relevantRepos.filter((it) => stagedOnly.includes(it.name))

    if (stagedRepos.length !== 0) {
        log(chalk.green('Staged repos:'))
        stagedRepos.forEach((it) => log(`- ${chalk.green(it.name)}`))

        await finalCheckAndCommitPush(stagedRepos)
    } else {
        log(chalk.red('No repos were staged with changes'))
    }
}

async function queryRepo(query: string, repo: string): Promise<boolean> {
    const result = await $`${{ raw: query }}`.cwd(`${GIT_CACHE_DIR}/${repo}`).quiet()

    return result.exitCode === 0
}

async function updateGitterCache(repos: BaseRepoNode<unknown>[]): Promise<void> {
    const gitter = new Gitter('cache')

    const results = await Promise.all(repos.map((it) => gitter.cloneOrPull(it.name, it.defaultBranchRef.name, true)))

    log(
        `\nUpdated ${chalk.yellow(results.filter((it) => it === 'updated').length)} and cloned ${chalk.yellow(
            results.filter((it) => it === 'cloned').length,
        )} repos\n`,
    )
}

async function getTargetRepos<Repo extends { name: string }>(otherRepos: Repo[]): Promise<Repo[]> {
    const checkboxResponse = await inquirer.prompt<{ target: string[] }>({
        type: 'checkbox',
        name: 'target',
        message: 'Select repos to run commands in',
        choices: [
            { value: 'all', name: 'All repos' },
            ...otherRepos.map((it) => ({
                name: it.name,
                value: it.name,
            })),
        ],
    })

    if (checkboxResponse.target.includes('all')) {
        return otherRepos
    } else if (checkboxResponse.target.length !== 0) {
        return otherRepos.filter((it) => checkboxResponse.target.includes(it.name))
    } else {
        log(chalk.red('You must select at least one repo'))
        return getTargetRepos(otherRepos)
    }
}

async function runCommand(
    cmd: string,
    force: boolean,
    repo: BaseRepoNode<unknown>,
    otherRepos: BaseRepoNode<unknown>[],
): Promise<[string, string][]> {
    const repoDir = `${GIT_CACHE_DIR}/${repo.name}`

    log(`${chalk.blue(repo.name)} $ ${chalk.yellow(cmd)}`)
    const result = await $`${{ raw: cmd }}`.cwd(repoDir).quiet()

    if (result.exitCode !== 0) {
        log(chalk.red(`Command failed in ${repo.name}`))
        log(chalk.red(result.stdout.toString()))
        log(chalk.red(result.stderr.toString()))

        if (otherRepos.length === 0) {
            return [[repo.name, 'failed']]
        } else {
            return [[repo.name, 'failed'], ...(await runCommand(cmd, force, otherRepos[0], otherRepos.slice(1)))]
        }
    }

    const diff = await new Gitter('cache').createRepoGitClient(repo.name).diffSummary()

    log(
        `${chalk.yellow(diff.files.length)} files changed, ${chalk.green(diff.insertions)} insertions(+), ${chalk.red(
            diff.deletions,
        )} deletions(-)`,
    )
    // show diff in files
    log(
        diff.files
            .map((it) => {
                if (it.binary) {
                    return `${it.file} (binary)`
                } else {
                    return `- ${it.file} +${chalk.green(it.insertions)}/-${chalk.red(it.deletions)}`
                }
            })
            .join('\n'),
    )

    if (diff.changed === 0) {
        log(chalk.yellow('No changes'))
        if (otherRepos.length === 0) {
            return [[repo.name, 'dismissed']]
        } else {
            return [[repo.name, 'dismissed'], ...(await runCommand(cmd, force, otherRepos[0], otherRepos.slice(1)))]
        }
    }

    const confirmResult = force
        ? { confirm: true }
        : await inquirer.prompt({
              name: 'confirm',
              type: 'confirm',
              message: `Do you want to stage these changes?`,
          })

    if (confirmResult.confirm) {
        if (otherRepos.length === 0) {
            return [[repo.name, 'staged']]
        } else {
            return [[repo.name, 'staged'], ...(await runCommand(cmd, force, otherRepos[0], otherRepos.slice(1)))]
        }
    } else {
        if (otherRepos.length === 0) {
            return [[repo.name, 'dismissed']]
        } else {
            return [[repo.name, 'dismissed'], ...(await runCommand(cmd, force, otherRepos[0], otherRepos.slice(1)))]
        }
    }
}

async function finalCheckAndCommitPush(stagedRepos: BaseRepoNode<unknown>[]): Promise<void> {
    const confirmResult = await inquirer.prompt({
        name: 'confirm',
        type: 'confirm',
        message: `Do you want to commit and push these changes?`,
    })

    if (confirmResult.confirm) {
        const gitter = new Gitter('cache')
        const commitMessage = await inquirer.prompt<{ message: string }>({
            type: 'input',
            name: 'message',
            message: `Enter commit message:`,
        })

        await Promise.all(
            stagedRepos.map(async (it) => {
                log(`Staging all files in ${chalk.blue(it.name)}`)
                const pushResult: PushResult = await gitter
                    .createRepoGitClient(it.name)
                    .add('.')
                    .commit(commitMessage.message)
                    .push()

                log(`${chalk.green(`Pushed to repo ${pushResult.repo}`)} - ${it.url}`)
            }),
        )
    } else {
        log(chalk.red('Aborting!'))
    }
}
