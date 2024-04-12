import path from 'node:path'

import { CACHE_DIR } from '../cache.ts'

const teamsCacheFile = path.join(CACHE_DIR, 'teams.json')

export async function updateTeamsCache(currentTeam: string): Promise<void> {
    const teams = await getTeamsCache()
    if (!teams.includes(currentTeam)) {
        teams.push(currentTeam)
        const file = Bun.file(teamsCacheFile)
        await Bun.write(file, JSON.stringify(teams))
    } else {
        return
    }
}

export async function getTeamsCache(): Promise<string[]> {
    const file = Bun.file(teamsCacheFile)
    if (!(await file.exists())) {
        return []
    }

    return file.json()
}
