import * as R from 'remeda'
import chalk from 'chalk'
import { log } from '../common/log.ts'

const REQUIRED_CLI = ['gh', 'yarn', 'kubectl', 'nais', 'gcloud'] as const
const CLI_CHECKS: [cli: (typeof REQUIRED_CLI)[number], check: () => string | null][] = [
    ['gh', checkGithubCli],
    ['kubectl', checkKubectl],
    ['yarn', () => defaultVersionCheck('yarn --version')],
    ['nais', () => defaultVersionCheck('nais --version')],
    ['gcloud', () => defaultVersionCheck('gcloud --version')],
]

export function checkTooling() {
    const missing = missingClis()
    if (missing.length > 0) {
        log(
            `The following CLIs are missing:\n`,
            chalk.red(missing.map((it) => ` - ${chalk.bold(it)}`)),
            '\n\nPlease install all missing tools and try again. :)',
        )
        return
    }

    const [ok, bad] = R.pipe(
        CLI_CHECKS,
        R.map(([cli, check]): [string, string | null] => [cli, check()]),
        R.partition(([, result]) => result == null),
    )

    if (ok.length) {
        log(chalk.green(`The following CLIs are good!`))
        log(chalk.red(ok.map(([cli, checkResult]) => ` ${chalk.green('✓')} ${chalk.white(cli)}`).join('\n')))
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

function checkGithubCli(): string | null {
    const res = Bun.spawnSync('gh auth status'.split(' '))
    const stdout = res.stderr.toString()
    if (res.exitCode === 0 && stdout.includes('Logged in to github.com')) {
        return null
    } else {
        return "You need to be logged in to github.com using gh cli. Run 'gh auth login' and follow the instructions."
    }
}

function checkKubectl(): string | null {
    const res = Bun.spawnSync('kubectl version --client --output=json'.split(' '))
    if (res.exitCode === 0) {
        return null
    } else {
        return "kubectl is not configured correctly. Please run 'kubectl version --client --output=json' to see what is wrong."
    }
}

function defaultVersionCheck(command: string): string | null {
    const res = Bun.spawnSync(`${command}`.split(' '))

    if (res.exitCode === 0) {
        return null
    } else {
        return `${command.split(' ').at(0)} is not configured correctly. Please run '${command}' to see what is wrong.`
    }
}

function missingClis(): string[] {
    return REQUIRED_CLI.filter((it) => !hasCli(it))
}

function hasCli(cli: string) {
    return Bun.spawnSync(`which ${cli}`.split(' ')).exitCode === 0
}
