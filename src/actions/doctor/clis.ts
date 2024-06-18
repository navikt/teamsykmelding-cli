import { REQUIRED_CLIS } from './config.ts'

export function missingClis(): string[] {
    return REQUIRED_CLIS.filter((it) => !hasCli(it))
}

function hasCli(cli: string): boolean {
    return Bun.spawnSync(`which ${cli}`.split(' ')).exitCode === 0
}
