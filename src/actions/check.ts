import * as R from 'remeda'
import chalk from 'chalk'
import { $, ShellPromise } from 'bun'

import { log } from '../common/log.ts'

const REQUIRED_CLI = ['gh', 'yarn', 'kubectl', 'nais', 'gcloud'] as const
const CLI_CHECKS: [cli: (typeof REQUIRED_CLI)[number], check: () => Promise<string | null>][] = [
    ['gh', checkGithubCli],
    ['kubectl', checkKubectl],
    ['yarn', () => defaultExistsCheck('yarn', $`yarn --version`)],
    ['nais', () => defaultExistsCheck('nais', $`nais --version`)],
    ['gcloud', () => defaultExistsCheck('gcloud', $`gcloud --version`)],
]

export async function checkTooling(): Promise<void> {
    log(chalk.blueBright('Checking tools...'))
    const missing = missingClis()
    if (missing.length > 0) {
        log(
            `The following CLIs are missing:\n`,
            chalk.red(missing.map((it) => ` - ${chalk.bold(it)}`)),
            '\n\nPlease install all missing tools and try again. :)',
        )
        return
    }

    const results = await R.pipe(
        CLI_CHECKS,
        R.map(async ([cli, check]) => [cli, await check()]),
        (it) => Promise.all(it),
    )
    const [ok, bad] = R.partition(results, ([, result]) => result == null)

    if (ok.length) {
        log(chalk.green(`The following CLIs are good!`))
        log(chalk.red(ok.map(([cli]) => ` ${chalk.green('✓')} ${chalk.white(cli)}`).join('\n')))
    }

    if (bad.length) {
        log(`\nThe following CLI is not configured correctly:`)
        log(
            chalk.red(
                bad.map(([cli, checkResult]) => ` - ${chalk.bold(cli)}: ${chalk.yellow(checkResult)}`).join('\n'),
            ),
        )
    } else {
        log(chalk.green(`\nEverything is OK`))
    }
}

async function checkGithubCli(): Promise<string | null> {
    const res = await $`gh auth status`.quiet()

    if (
        res.exitCode === 0 &&
        // gh on OSX puts output in stdout,gh on linux puts it in stderr
        (res.stdout.includes('Logged in to github.com') || res.stderr.includes('Logged in to github.com'))
    ) {
        return null
    } else {
        return "You need to be logged in to github.com using gh cli. Run 'gh auth login' and follow the instructions."
    }
}

async function checkKubectl(): Promise<string | null> {
    const res = await $`kubectl version --client --output=json`.quiet()
    if (res.exitCode === 0) {
        return null
    } else {
        return "kubectl is not configured correctly. Please run 'kubectl version --client --output=json' to see what is wrong."
    }
}

async function defaultExistsCheck(what: string, command: ShellPromise): Promise<string | null> {
    const res = await command.quiet()

    if (res.exitCode === 0) {
        return null
    } else {
        return `${what} is not configured correctly. Please run '${command}' to see what is wrong.`
    }
}

function missingClis(): string[] {
    return REQUIRED_CLI.filter((it) => !hasCli(it))
}

function hasCli(cli: string): boolean {
    return Bun.spawnSync(`which ${cli}`.split(' ')).exitCode === 0
}
