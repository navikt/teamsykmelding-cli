import { $ } from 'bun'

import { logError } from '../common/log.ts'

export async function auth(): Promise<void> {
    const res = await $`gcloud auth login --update-adc`

    if (res.exitCode === 0) {
        return
    } else {
        logError(`gcloud didn't seem to auth properly. :(`)
    }
}
