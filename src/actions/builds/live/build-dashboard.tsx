import { serve } from 'bun'
import * as R from 'remeda'
import { formatDistanceToNowStrict, parseISO } from 'date-fns'

import { log } from '../../../common/log.ts'
import { openUrl } from '../../../common/open-url.ts'
import { ghGqlQuery, OrgTeamRepoResult, removeIgnoredAndArchived } from '../../../common/octokit.ts'
import { BuildsBranchRefNode, buildsQuery } from '../builds.ts'
import { getTeam } from '../../../common/config.ts'

export async function liveBuildDashboard(): Promise<void> {
    serve({
        port: 1337,
        async fetch(req) {
            if (req.headers.get('accept')?.includes('text/html')) {
                // return dashboard.html
                return new Response(Bun.file(import.meta.dir + '/dashboard.html'))
            }

            if (req.url.endsWith('/api/repos')) {
                return new Response(await returnReposFragments(), {
                    headers: { 'content-type': 'text/html' },
                })
            }

            // 404
            return new Response('Not found', { status: 404 })
        },
    })

    log('View dashboard at http://localhost:1337')
    await openUrl('http://localhost:1337')
}

async function returnReposFragments(): Promise<string> {
    const reposByState = await getReposByState()

    return html`
        ${reposByState
            .map((repo) => {
                const status =
                    repo.action?.status === 'IN_PROGRESS' ? 'BUILDING' : (repo.action?.conclusion ?? 'unknown')

                return html`<div class="relative border rounded p-2 pb-8 ${actionToClass(status)}">
                    <h3 class="font-bold">${repo.name}</h3>
                    <div>
                        <a
                            target="_blank"
                            class="underline"
                            href="https://github.com/navikt/${repo.name}/actions/runs/${repo.action?.workflowRun
                                ?.databaseId}"
                            >${status}</a
                        >
                        ${formatDistanceToNowStrict(repo.lastPush, {
                            addSuffix: true,
                        })}
                    </div>
                    <div class="text-sm mt-2 absolute bottom-2 left-2">
                        Last push
                        ${formatDistanceToNowStrict(repo.lastPush, {
                            addSuffix: true,
                        })}
                    </div>
                    <div class="absolute bottom-2 right-2">
                        <a class="underline" href="https://github.com/navikt/${repo.name}" target="_blank">(repo)</a>
                    </div>
                </div>`
            })
            .join('')}
    `
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
async function getReposByState() {
    const team = await getTeam()
    const queryResult = await ghGqlQuery<OrgTeamRepoResult<BuildsBranchRefNode>>(buildsQuery, {
        team,
    })

    return R.pipe(
        queryResult.organization.team.repositories.nodes,
        removeIgnoredAndArchived,
        R.map((repo) => ({
            name: repo.name,
            lastPush: parseISO(repo.pushedAt),
            commit: repo.defaultBranchRef.target.message,
            action: R.pipe(
                repo.defaultBranchRef.target.checkSuites.nodes,
                R.sortBy([(it) => it.workflowRun?.updatedAt ?? '', 'desc']),
                R.find((it) => it.workflowRun?.event === 'push'),
            ),
        })),
        R.filter((it) => it.action?.workflowRun != null),
        R.sortBy([(it) => it.lastPush, 'desc']),
    )
}

function actionToClass(status: string): string {
    switch (status) {
        case 'SUCCESS':
            return 'bg-green-100'
        case 'FAILURE':
            return 'bg-red-100'
        case 'BUILDING':
            return 'bg-yellow-100'
        default:
            return 'bg-gray-100'
    }
}

function html(strings: TemplateStringsArray, ...values: unknown[]): string {
    let str = ''
    strings.forEach((string, i) => {
        str += string + (values[i] ?? '')
    })
    return str
}
