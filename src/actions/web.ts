import * as R from 'remeda'
import chalk from 'chalk'

import inquirer, { hackilyFixBackToBackPrompt } from '../common/inquirer.ts'
import { log } from '../common/log.ts'
import { openUrl } from '../common/open-url.ts'

type Envs = {
    dev: string
    prod: string
    demo?: string
}

const isKnowit = ['andreassagenaspaas', 'karl'].includes(Bun.env.USER ?? '')
const knowitPages = {
    ubw: 'https://ubw.knowit.se',
}
const hiddenPages = {
    helg: 'https://helg.karl.run/nyan',
}

const staticPages = {
    mock: 'https://teamsykmelding-mock.intern.dev.nav.no/',
    docs: 'https://teamsykmelding.intern.nav.no/',
    unleash: 'https://teamsykmelding-unleash-web.nav.cloud.nais.io/',
    ida: 'https://ida.intern.nav.no/',
    flexjar: 'https://flexjar.intern.nav.no/',
    amplitude: 'https://app.eu.amplitude.com/analytics/nav/space/e-i94ld6q/',
}

const availablePages = {
    ...staticPages,
    ...{ ...(isKnowit ? knowitPages : {}) },
    ...hiddenPages,
}

type PageKeys = (typeof pageKeys)[number]
const pageKeys = R.keys.strict(staticPages)

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

export async function openResource(what: string | null, env: string | null): Promise<void> {
    if (what != null && isPage(what)) {
        await openUrl(availablePages[what])
        return
    }

    if (what != null && isApp(what)) {
        const selectedEnv = (env as keyof Envs) ?? (await getAppEnv(what))
        await openApp(what, selectedEnv)
        return
    }

    const everything = [
        ...R.difference(R.keys(availablePages), R.keys(hiddenPages)),
        ...R.keys(availableApps).map((it) => `app: ${it}`),
    ]

    const initialFilteredValues = everything.filter((page) => page.includes(what ?? ''))
    // If the initial input only yields a single hit, just open it
    if (initialFilteredValues.length === 1) {
        await openAppOrPage(initialFilteredValues[0])
        return
    }

    const { selectedRootItem } = await inquirer.prompt([
        {
            type: 'autocomplete',
            name: 'selectedRootItem',
            message: 'What do you want to open?',
            source: async (_: unknown, input: string) =>
                everything.filter((page) => page.includes(input ?? what ?? '')),
        },
    ])

    await openAppOrPage(selectedRootItem)
}

async function openAppOrPage(appOrPage: string): Promise<void> {
    const cleanItem = appOrPage.replace('app: ', '')

    if (!isApp(cleanItem)) {
        const staticPage = availablePages[cleanItem as PageKeys]

        await openUrl(staticPage)
        return
    }

    await hackilyFixBackToBackPrompt()
    const selectedEnv = await getAppEnv(cleanItem)

    await openApp(cleanItem, selectedEnv)
}

async function openApp(app: AppKeys, env: keyof Envs): Promise<void> {
    const url = availableApps[app][env]

    log(`Opening ${chalk.blue(url)}...`)
    await openUrl(url)
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
