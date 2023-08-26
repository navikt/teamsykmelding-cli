import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { checkTooling } from './actions/check.ts'
import { lastCommits } from './actions/last-commits.ts'

await yargs(hideBin(process.argv))
    .scriptName('tsm')
    .command('check', 'check that all tooling looks OK', async () => checkTooling())
    .command(
        'commits',
        'get the last commits for every repo in the team',
        (yargs) =>
            yargs
                .positional('order', {
                    type: 'string',
                    default: 'desc',
                    describe: 'the order the commits should be sorted in',
                    choices: ['asc', 'desc'],
                })
                .positional('limit', {
                    type: 'number',
                    default: undefined,
                    describe: 'the number of commits to return',
                }),
        async (args) => {
            console.log(args);
            return lastCommits(args.order as 'asc' | 'desc', args.limit)
        },
    )
    .demandCommand()
    .parse()
