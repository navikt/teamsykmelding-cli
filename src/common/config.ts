import path from 'node:path'
import { CACHE_DIR } from './cache.ts'

type Config = {
    gitDir: string | undefined
}

const defaultConfig: Config = {
    gitDir: undefined,
}

const configFile = Bun.file(path.join(CACHE_DIR, 'config.json'))

export async function updateConfig(config: Partial<Config>): Promise<Config> {
    const currentConfig = getConfig()
    const newConfig = { ...currentConfig, ...config }

    await Bun.write(configFile, JSON.stringify(newConfig))

    return newConfig
}

export async function getConfig(): Promise<Config> {
    if (!(await configFile.exists())) {
        await Bun.write(configFile, JSON.stringify(defaultConfig))
        return defaultConfig
    }

    return configFile.json<Config>()
}
