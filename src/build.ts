import chalk from 'chalk'

import { version } from '../tsm-cli/package.json'

import { log, logError } from './common/log.ts'

const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    target: 'bun',
    external: ['yoga-wasm-web'],
    define: {
        'process.env.COMPILED_BINARY': '"true"',
    },
})

if (result.outputs.length > 1) {
    throw new Error('Expected only one output')
}

if (!result.success) {
    logError(result.logs)
    process.exit(1)
}

const [artifact] = result.outputs
const outputWriter = Bun.file('./tsm-cli/bin/tsm').writer()

outputWriter.write('#!/usr/bin/env bun\n')
outputWriter.write(await artifact.text())

Bun.spawnSync('chmod +x ./tsm-cli/bin/tsm'.split(' '), { stdout: 'inherit' })

log(
    `Built ${version} (${chalk.green(`${(artifact.size / 1024).toFixed(0)}KB`)}) bytes to ${chalk.yellow(
        './tsm-cli/bin/tsm',
    )}`,
)
