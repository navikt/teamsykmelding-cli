import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { checkTooling } from './actions/check.ts'
import {lastCommits} from "./actions/last-commits.ts";

await yargs(hideBin(process.argv))
    .scriptName('tsm')
    .command('check', 'check that all tooling looks OK', async () => checkTooling())
    .command('commits', 'get the last commits for every repo in the team', async () => lastCommits())
    .demandCommand()
    .parse()
