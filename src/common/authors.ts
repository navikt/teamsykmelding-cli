import path from 'node:path'

import chalk from 'chalk'

import { CACHE_DIR } from './cache.ts'
import inquirer from './inquirer.ts'
import { log } from './log.ts'

export type Author = [name: string, email: string, user: string]

const authorOptions: Author[] = [
    ['Karl O', 'k@rl.run', 'karl'],
    ['Andreas', 'danduras@gmail.com', 'andreassagenaspaas'],
    ['Natalie Uranes', 'natalie.uranes@gmail.com', 'natalieu'],
    ['Joakim Taule Kartveit', 'joakimkartveit@gmail.com', 'joakim'],
    ['Bendik Berntsen', 'Bendik.Berntsen@nav.no', 'bendikberntsen'],
    ['Fridtjof Alestrøm', 'fridtjof.gustaf.alestrom@nav.no', 'fridtjofalestrom'],
    ['Helene Arnesen', 'helene.arnesen@nav.no', 'helenearnesen'],
    ['Jørn-Are Flaten', 'ja.flaten91@gmail.com', 'jaflaten'],
]

export async function promptForCoAuthors(): Promise<Author[]> {
    const previouslyUsedCoAuthors = await getCachedCoAuthors()

    const selectedAuthors = await inquirer.prompt({
        type: 'checkbox',
        choices: authorOptions
            .filter(([, , user]) => Bun.env.USER !== user)
            .map(([name, email, user]) => ({
                name: `${name.split(' ')[0]}`,
                value: [name, email, user],
                checked: previouslyUsedCoAuthors?.find((prev) => name === prev[0]),
            })),
        message: 'Select co-authors',
        name: 'coAuthors',
    })

    if (selectedAuthors.coAuthors.length === 0) {
        log(chalk.red('You must select at least one co-author'))
        return promptForCoAuthors()
    }

    await cacheCoAuthors(selectedAuthors.coAuthors)

    return selectedAuthors.coAuthors
}

export function createCoAuthorsText(authors: Author[]): string {
    return authors.map(([name, email]) => `Co-authored-by: ${name} <${email}>`).join('\n')
}

async function cacheCoAuthors(authors: Author[]): Promise<void> {
    const coAuthorsFile = Bun.file(path.join(CACHE_DIR, 'co-authors.json'))

    await Bun.write(coAuthorsFile, JSON.stringify(authors))
}

async function getCachedCoAuthors(): Promise<Author[] | []> {
    const coAuthorsFile = Bun.file(path.join(CACHE_DIR, 'co-authors.json'))

    if (await coAuthorsFile.exists()) {
        return coAuthorsFile.json<Author[]>()
    }

    return []
}
