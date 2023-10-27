import { logError } from '../common/log.ts'

export function auth(): void {
    const res = Bun.spawnSync(`gcloud auth login --update-adc`.split(' '), {
        stdout: 'inherit',
        stderr: 'inherit',
    })

    if (res.exitCode === 0) {
        return
    } else {
        logError(`gcloud didn't seem to auth properly. :(`)
    }
}
