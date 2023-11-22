import { Args, Command } from './types.ts'
import { usageDiff } from './diff.ts'
import { updateAnalyticsCache } from './analytics.ts'
import { updateGlobalAnalytics } from './analytics-global.ts'

export async function updateAnalytics(command: Command[], args?: Args): Promise<void> {
    const commandsDiff = usageDiff(command, args)

    await updateAnalyticsCache(commandsDiff)
    await updateGlobalAnalytics(commandsDiff)
}
