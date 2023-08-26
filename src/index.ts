import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { checkTooling } from './actions/check.ts'

await yargs(hideBin(process.argv))
    .command('check', 'check that all tooling looks OK', async () => checkTooling())
    .default('help', true)
    .parse()
