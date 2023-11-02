// TODO don't disable eslint? :D
/* eslint-disable */
import {getAllAppNames, promptForAppName} from "../common/kubectl.ts";
interface BearerTokenResponse {
    access_token: string;
}
export async function azure(appname: string | undefined | null, scope: string) : Promise<void> {
    const podList = Bun.spawnSync('kubectl get pods -l azure=enabled -o json'.split(' '))
    const pods = JSON.parse(podList.stdout.toString()).items
    const appsAndPods = getAllAppNames(pods)
    const {pod} = await promptForAppName(appsAndPods, appname)

    const azureCredentials = pod.spec.volumes
        .filter((volume: any) => volume.name.startsWith("azure"))
        .map((volume: any) => volume.secret.secretName)

    if(azureCredentials.length === 0) {
        console.error(`No azure credentials found for app ${appname}`)
        return
    }
    const output = Bun.spawnSync(`kubectl get secret ${azureCredentials[0]} -o json`.split(' '))
    if (output.exitCode !== 0) {
        console.error(`Failed to get secret ${output}: ${output.stderr}`)
        return
    }
    const secretData = JSON.parse(output.stdout.toString()).data
    const tokenEndpoint = Buffer.from(secretData.AZURE_OPENID_CONFIG_TOKEN_ENDPOINT, 'base64').toString()
    const clientId = Buffer.from(secretData.AZURE_APP_CLIENT_ID, 'base64').toString()
    const clientSecret = Buffer.from(secretData.AZURE_APP_CLIENT_SECRET, 'base64').toString()

    const data = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: scope
    });

    const result = await fetch(tokenEndpoint.toString(), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data
    })

    if(!result.ok) {
        console.error(`Failed to get token: ${result.statusText}`)
        console.error(await result.text())
        return
    }

    const token = (await result.json() as BearerTokenResponse).access_token

    console.log(token)
}

