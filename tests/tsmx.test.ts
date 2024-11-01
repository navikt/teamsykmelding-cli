import { test, expect } from 'bun:test'
import { CLITest, ANSI } from 'interactive-cli-tester'

test('tsmx should provide team and cluster options and set accordingly', async () => {
    const cli = new CLITest('./tsm-cli/bin/tsmx')

    await cli.run()

    await cli.waitForOutput('Change team context to')
    expect(cli.getOutput()).toInclude('❯ teamsykmelding')
    expect(cli.getOutput()).toInclude('tsm')

    await cli.write(ANSI.CURSOR_DOWN + ANSI.CR)
    await cli.getNextOutput()
    expect(cli.getOutput()).toInclude('teamsykmelding')
    expect(cli.getOutput()).toInclude('❯ tsm')

    await cli.waitForOutput('Which cluster?')
    expect(cli.getOutput()).toInclude('❯ dev-gcp')
    expect(cli.getOutput()).toInclude('prod-gcp')

    await cli.write(ANSI.CURSOR_DOWN + ANSI.CR)
    await cli.getNextOutput()
    expect(cli.getOutput()).toInclude('dev-gcp')
    expect(cli.getOutput()).toInclude('❯ prod-gcp')

    expect(await cli.waitForExit()).toBe(0)

    const output = cli.getOutput()
    expect(output).toInclude('→ Cluster set to prod-gcp')
    expect(output).toInclude('→ Namespace set to tsm')
    expect(output).toInclude('→ tsm team switched to tsm')
})
