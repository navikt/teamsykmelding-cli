import path from 'node:path'

import { CACHE_DIR } from './cache.ts'

type Config = {
    gitDir: string | undefined
    ide: string | undefined
}

const defaultConfig: Config = {
    gitDir: undefined,
    ide: 'idea',
}

const configFile = Bun.file(path.join(CACHE_DIR, 'config.json'))

export async function updateConfig(config: Partial<Config>): Promise<Config> {
    const currentConfig = getConfig()
    const newConfig = { ...currentConfig, ...config }

    await Bun.write(configFile, JSON.stringify(newConfig))

    return newConfig
}

export async function getConfig(): Promise<Config> {
    let config: Config
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
