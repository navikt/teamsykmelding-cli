import * as R from 'remeda'
import open from 'open'
import chalk from 'chalk'

import inquirer from '../common/inquirer.ts'
import { log } from '../common/log.ts'

type Envs = {
    dev: string
    prod: string
    demo?: string
}

const availablePages = {
    mock: 'https://teamsykmelding-mock.intern.dev.nav.no/',
    docs: 'https://teamsykmelding.intern.nav.no/',
    unleash: 'https://teamsykmelding-unleash-web.nav.cloud.nais.io/',
}

type PageKeys = (typeof pageKeys)[number]
const pageKeys = R.keys.strict(availablePages)

const availableApps = {
    sykmeldinger: {
        dev: 'https://www.ekstern.dev.nav.no/syk/sykmeldinger',
        demo: 'https://sykmeldinger.ekstern.dev.nav.no/syk/sykmeldinger',
        prod: 'https://www.nav.no/syk/sykmeldinger',
    } satisfies Envs,
    dinesykmeldte: {
        dev: 'https://www.ekstern.dev.nav.no/arbeidsgiver/sykmeldte',
        demo: 'https://dinesykmeldte.ekstern.dev.nav.no/arbeidsgiver/sykmeldte',
        prod: 'https://www.nav.no/arbeidsgiver/sykmeldte',
    } satisfies Envs,
    'syk-dig': {
        dev: 'https://syk-dig.intern.dev.nav.no',
        demo: 'https://syk-dig.ekstern.dev.nav.no/',
        prod: 'https://syk-dig.intern.nav.no/',
    } satisfies Envs,
    'sykmelder-statistikk': {
        dev: 'https://www.ekstern.dev.nav.no/samarbeidspartner/sykmelder-statistikk',
        demo: 'https://sykmelder-statistikk.ekstern.dev.nav.no/samarbeidspartner/sykmelder-statistikk',
        prod: 'https://www.nav.no/samarbeidspartner/sykmelder-statistikk',
    } satisfies Envs,
    smregistrering: {
        dev: 'https://smregistrering.intern.dev.nav.no/',
        demo: 'https://smregistrering.ekstern.dev.nav.no/?oppgaveid=123',
        prod: 'https://smregistrering.intern.nav.no/',
    } satisfies Envs,
    syfosmmanuell: {
        dev: 'https://syfosmmanuell.intern.dev.nav.no/',
        demo: 'https://syfosmmanuell.ekstern.dev.nav.no/?oppgaveid=123',
        prod: 'https://syfosmmanuell.intern.nav.no/',
    } satisfies Envs,
}

type AppKeys = (typeof appKeys)[number]
const appKeys = R.keys.strict(availableApps)

export async function openResource(what: string | null): Promise<void> {
    if (what != null && isPage(what)) {
        await open(availablePages[what])
        return
    }

    if (what != null && isApp(what)) {
        const selectedEnv = await getAppEnv(what)
        await openApp(what, selectedEnv)
        return
    }

    const everything = [...R.keys(availablePages), ...R.keys(availableApps).map((it) => `app: ${it}`)]
    const { selectedRootItem } = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'selectedRootItem',
            message: 'What do you want to open?',
            source: async (_: unknown, input: string) =>
                everything.filter((page) => page.includes(input ?? what ?? '')),
        },
    ])
    const cleanItem = selectedRootItem.replace('app: ', '')

    if (!isApp(cleanItem)) {
        const staticPage = availablePages[cleanItem as PageKeys]

        await open(staticPage)
        return
    }

    const selectedEnv = await getAppEnv(cleanItem)
    await openApp(cleanItem, selectedEnv)
}

async function openApp(app: AppKeys, env: keyof Envs): Promise<void> {
    const url = availableApps[app][env]

    log(`Opening ${chalk.blue(url)}...`)
    await open(url)
}

async function getAppEnv(app: AppKeys): Promise<keyof Envs> {
    const envs = availableApps[app]
    const { selectedEnv } = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'selectedEnv',
            message: `What environment for ${app} do you want to open?`,
            source: async (_: unknown, input: string) => R.keys(envs).filter((page) => page.includes(input ?? '')),
        },
    ])

    return selectedEnv
}

function isPage(what: string): what is PageKeys {
    return what in availablePages
}

function isApp(what: string): what is AppKeys {
    return what in availableApps
}
