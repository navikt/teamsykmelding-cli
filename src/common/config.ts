import path from 'node:path'
import fs from 'node:fs'

import chalk from 'chalk'

import { CACHE_DIR } from './cache.ts'
import { log } from './log.ts'

export const CONFIG_DIR = path.join(Bun.env.HOME ?? '~', '.config', 'tsm')

// Dumbly just create the cache dir, we don't care, same as cache dir
fs.mkdirSync(CONFIG_DIR, { recursive: true })
// Migrate config from cache dir to config dir for a little while
await migrateFromCacheToConfigDir(CACHE_DIR, CONFIG_DIR)

type Config = {
    gitDir: string | undefined
    ide: string | undefined
    coAuthors: [string, string, string][] | undefined
}

const defaultConfig: Config = {
    gitDir: undefined,
    ide: 'idea',
    coAuthors: undefined,
}

export async function updateConfig(config: Partial<Config>): Promise<Config> {
    const currentConfig: Config = await getConfig()
    const newConfig = { ...currentConfig, ...config }

    const configFile = Bun.file(path.join(CONFIG_DIR, 'config.json'))
    await Bun.write(configFile, JSON.stringify(newConfig))

    return newConfig
}

export async function getConfig(): Promise<Config> {
    let config: Config

    const configFile = Bun.file(path.join(CONFIG_DIR, 'config.json'))
    if (!(await configFile.exists())) {
        config = defaultConfig
        await Bun.write(configFile, JSON.stringify(defaultConfig))
    } else {
        config = await configFile.json<Config>()
    }

    if (!config.ide) {
        config.ide = 'idea'
        await Bun.write(configFile, JSON.stringify(config))
    }

    return config
}

export async function migrateFromCacheToConfigDir(cacheDir: string, configDir: string): Promise<void> {
    const configInCacheDir = path.join(cacheDir, 'config.json')
    const cacheConfigFile = Bun.file(configInCacheDir)
    if (await cacheConfigFile.exists()) {
        log(chalk.blue('\n...Found config in cache dir, migrating to config dir. This is a one-time-thing. :)\n'))
        const cacheConfigContent = await cacheConfigFile.json<Config>()
        const newConfigFile = Bun.file(path.join(configDir, 'config.json'))
        await Bun.write(newConfigFile, JSON.stringify(cacheConfigContent))
        fs.unlinkSync(configInCacheDir)
    }
}
