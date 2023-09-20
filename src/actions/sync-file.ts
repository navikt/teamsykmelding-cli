import * as R from 'remeda'
import gluegun from 'gluegun'
import chalk from 'chalk'
import path from 'node:path'

import { BaseRepoNodeFragment, ghGqlQuery, OrgTeamRepoResult, removeIgnoredAndArchived } from '../common/octokit.ts'
import { log } from '../common/log.ts'
import { PushResult } from 'simple-git'
import { Gitter } from '../common/git.ts'
import { GIT_CACHE_DIR } from '../common/cache.ts'

const reposQuery = /* GraphQL */ `
    query ($team: String!) {
        organization(login: "navikt") {
            team(slug: $team) {
                repositories(orderBy: { field: PUSHED_AT, direction: DESC }) {
                    nodes {
                        ...BaseRepoNode
                    }
                }
            }
        }
    }

    ${BaseRepoNodeFragment}
`

async function getAllRepos() {
    log(chalk.green(`Getting all active repositories for team teamsykmelding...`))

    const result = await ghGqlQuery<OrgTeamRepoResult<unknown>>(reposQuery, {
        team: 'teamsykmelding',
    })

    return removeIgnoredAndArchived(result.organization.team.repositories.nodes)
}

async function cloneAllRepos() {
    const gitter = new Gitter('cache')
    const repos = await getAllRepos()
    const results = await Promise.all(repos.map((it) => gitter.cloneOrPull(it.name, it.defaultBranchRef.name)))

    log(
        `Updated ${chalk.yellow(results.filter((it) => it === 'updated').length)} and cloned ${chalk.yellow(
            results.filter((it) => it === 'cloned').length,
        )} repos`,
    )

    return repos
}

function queryRepo(query: string, repo: string) {
    const result = Bun.spawnSync(query.split(' '), {
        cwd: `${GIT_CACHE_DIR}/${repo}`,
    })

    return result.exitCode === 0
}

async function getTargetRepos<Repo extends { name: string }>(otherRepos: Repo[]): Promise<Repo[]> {
    const gluegunAskResponse = await gluegun.prompt.ask<{ target: string[] }>({
        type: 'multiselect',
        name: 'target',
        message: 'Select repos to copy file to',
        required: true,
        choices: [
            { value: 'all', name: 'All repos' },
            ...otherRepos.map((it) => ({
                name: it.name,
                value: it.name,
            })),
        ],
    })

    console.log(gluegunAskResponse.target)

    if (gluegunAskResponse.target.includes('All repos')) {
        return otherRepos
    } else if (gluegunAskResponse.target.length !== 0) {
        return otherRepos.filter((it) => gluegunAskResponse.target.includes(it.name))
    } else {
        log(chalk.red('You must select at least one repo'))
        return getTargetRepos(otherRepos)
    }
}

export async function syncFileAcrossRepos(query: string) {
    const repos = await cloneAllRepos()

    if (!query) {
        throw new Error('Missing query')
    }

    const relevantRepos = R.pipe(
        repos,
        R.map((it) => [it, queryRepo(query, it.name)] as const),
        R.filter(([, result]) => result),
        R.map(([name]) => name),
    )

    const sourceRepo = await gluegun.prompt.ask<{ source: string }>({
        type: 'select',
        name: 'source',
        message: 'Select source repository',
        choices: relevantRepos.map((it) => ({ name: it.name, value: it.name })),
    })

    const otherRepos = relevantRepos.filter((it) => it.name !== sourceRepo.source)
    const targetRepos = await getTargetRepos(otherRepos)
    const fileToSync = await getValidFileInSource(sourceRepo.source)
    const commitMessage = await gluegun.prompt.ask<{ message: string }>({
        type: 'input',
        name: 'message',
        message: 'Commit message for sync commits',
    })

    log(`The file "${chalk.yellow(fileToSync)}" will be synced across the following repos:`)
    log(targetRepos.map((it) => ` - ${it.name}`).join('\n'))
    log(`The commit message will be "${chalk.yellow(commitMessage.message)}"`)

    const confirmResult = await gluegun.prompt.confirm(
        `Do you want to continue? This will create ${otherRepos.length} commits, one for each repo.`,
    )

    if (confirmResult) {
        await copyFileToRepos(sourceRepo.source, targetRepos, fileToSync, commitMessage.message)
    } else {
        log(chalk.red('Aborting!'))
    }
}

async function getValidFileInSource(sourceRepo: string) {
    const file = await gluegun.prompt.ask<{ file: string }>({
        type: 'input',
        name: 'file',
        message: `Which file in ${sourceRepo} should be synced across? \n (Path should be root in repo)`,
    })
    const bunFile = Bun.file(path.join(GIT_CACHE_DIR, sourceRepo, file.file))
    console.log(path.join(GIT_CACHE_DIR, sourceRepo, file.file))
    if (await bunFile.exists()) {
        return file.file
    }

    log(chalk.red(`Could not find file ${file.file} in ${sourceRepo}`))

    return getValidFileInSource(sourceRepo)
}

async function copyFileToRepos(
    sourceRepo: string,
    targetRepos: { name: string; url: string }[],
    fileToSync: string,
    message: string,
) {
    const gitter = new Gitter('cache')
    const sourceFile = Bun.file(path.join(GIT_CACHE_DIR, sourceRepo, fileToSync))

    await Promise.all(
        targetRepos.map(async (it) => {
            log(`Copying ${chalk.yellow(`${it.name}/${fileToSync}`)} from ${chalk.yellow(sourceRepo)}`)
            const targetFile = Bun.file(path.join(GIT_CACHE_DIR, it.name, fileToSync))
            await Bun.write(targetFile, sourceFile)

            const pushResult: PushResult = await gitter
                .createRepoGitClient(it.name)
                .add(fileToSync)
                .commit(message)
                .push()

            log(`${chalk.green(`Pushed to repo ${pushResult.repo} to branch ${pushResult.branch}`)} - ${it.url}`)
        }),
    )
}
