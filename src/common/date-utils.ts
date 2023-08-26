import chalk from 'chalk'
import { differenceInDays, formatDistanceStrict } from 'date-fns'

export function coloredTimestamp(timestamp: Date): string {
    const now = new Date()
    const daysSince = differenceInDays(now, timestamp)
    const distance = formatDistanceStrict(timestamp, now)
    if (daysSince < 7) {
        return chalk.green(distance)
    } else if (daysSince < 14) {
        return chalk.yellow(distance)
    } else {
        return chalk.cyan(distance)
    }
}
