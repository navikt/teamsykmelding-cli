// TODO don't disable eslint? :D
/* eslint-disable */
import inquirer from "./inquirer.ts";

export function getAllAppNames(pods: any[]): Map<string, any[]> {
    const appPodMap = new Map<string, any>()
    pods.forEach((pod) => {
        const appName = pod.metadata.labels.app
        if (appName && !appPodMap.has(appName)) {
            appPodMap.set(appName, pod)
        }
    })
    return appPodMap
}

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
