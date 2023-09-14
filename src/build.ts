import { version } from '../tsm-cli/package.json'
import chalk from 'chalk'

const result = await Bun.build({
    entrypoints: ['src/index.ts'],
    target: 'bun',
})

if (result.outputs.length > 1) {
    throw new Error('Expected only one output')
}

const [artifact] = result.outputs
const outputWriter = Bun.file('./tsm-cli/bin/tsm').writer()

outputWriter.write('#!/usr/bin/env bun\n')
outputWriter.write(await artifact.text())

const bytesWritten = await outputWriter.end()

Bun.spawnSync('chmod +x ./tsm-cli/bin/tsm'.split(' '), { stdout: 'inherit' })

console.info(
    `Built ${version} (${chalk.green(`${(artifact.size / 1024).toFixed(0)}KB`)}) bytes to ${chalk.yellow(
        './tsm-cli/bin/tsm',
    )}`,
)
