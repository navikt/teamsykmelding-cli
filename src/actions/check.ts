import * as R from 'remeda'
import chalk from 'chalk'
import { log } from '../common/log.ts'

const REQUIRED_CLI = ['gh', 'yarn', 'kubectl', 'nais'] as const
const CLI_CHECKS: [cli: (typeof REQUIRED_CLI)[number], check: () => string | null][] = [
    ['gh', checkGithubCli],
    ['kubectl', checkKubectl],
    ['yarn', () => null],
    ['nais', () => null],
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

    const result = R.pipe(
        CLI_CHECKS,
        R.map(([cli, check]): [string, string | null] => [cli, check()]),
        R.filter(([, checkResult]) => checkResult != null),
        (errors) => {
            return errors
        },
        R.map(([cli, checkResult]) => {
            return ` - ${chalk.bold(cli)}: ${chalk.yellow(checkResult)}`
        }),
    )

    if (result.length) {
        log(`The following CLI is not configured correctly:`)
        log(chalk.red(result.join('\n')))
    } else {
        log(chalk.green(`All CLIs are configured correctly!`))
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

function missingClis(): string[] {
    return REQUIRED_CLI.filter((it) => !hasCli(it))
}

function hasCli(cli: string) {
    return Bun.spawnSync(`which ${cli}`.split(' ')).exitCode === 0
}
