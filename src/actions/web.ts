import * as R from 'remeda'
import open from 'open'

import inquirer from '../common/inquirer.ts'

const availablePages = {
    mock: 'https://teamsykmelding-mock.intern.dev.nav.no/',
    docs: 'https://teamsykmelding.intern.nav.no/',
}

const keys = R.keys.strict(availablePages)

type Keys = (typeof keys)[number]

export async function openResource(what: string | null): Promise<void> {
    if (what != null && isPage(what)) {
        await open(availablePages[what])
        return
    }

    const { selectedPage } = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'selectedPage',
            message: 'Hva vil du åpne?',
            source: async (_: unknown, input: string) =>
                Object.keys(availablePages).filter((page) => page.includes(input ?? what ?? '')),
        },
    ])

    await open(availablePages[selectedPage as Keys])
}

function isPage(what: string): what is Keys {
    return what in availablePages
}
