import { $ } from 'bun'
import chalk from 'chalk'

import inquirer from './inquirer.ts'
import { log } from './log.ts'

// eslint-disable-next-line
export function getAllAppNames(pods: any[]): Map<string, any[]> {
    // eslint-disable-next-line
    const appPodMap = new Map<string, any>()
    pods.forEach((pod) => {
        const appName = pod.metadata.labels.app
        if (appName && !appPodMap.has(appName)) {
            appPodMap.set(appName, pod)
        }
    })
    return appPodMap
}

// eslint-disable-next-line
export async function promptForAppName(appPodMap: Map<string, any>, appname: string | undefined | null) {
    // Convert Map keys into an array of app names
    const appNames: string[] = Array.from(appPodMap.keys())
    const appInput = appname || ''
    const { appName } = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'appName',
            message: 'Start typing to search for an app',
            source: function (_: unknown, input: string) {
                return new Promise(function (resolve) {
                    const results = appNames.filter((app) => app.includes(input ?? appInput))
                    resolve(results)
                })
            },
        },
    ])

    return {
        appName,
        pod: appPodMap.get(appName),
    }
}

export async function changeContext(namespace: string, cluster: 'dev-gcp' | 'prod-gcp'): Promise<void> {
    const clusterOutput = await $`kubectl config use-context ${cluster}`.quiet()
    const namespaceOutput = await $`kubectl config set-context --current --namespace=${namespace}`.quiet()

    if (clusterOutput.exitCode === 0) {
        log(`→ Cluster set to ${chalk.green(cluster)}`)
    } else {
        log(chalk.red(`Failed to set cluster: ${clusterOutput.stderr.toString()}`))
    }

    if (namespaceOutput.exitCode === 0) {
        log(`→ Namespace set to ${chalk.green(namespace)}`)
    } else {
        log(chalk.red(`Failed to set namespace: ${namespaceOutput.stderr.toString()}`))
    }
}
