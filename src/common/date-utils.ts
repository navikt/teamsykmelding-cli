import chalk from 'chalk'
import { differenceInDays, format, formatDistanceStrict, formatISO, parseISO, subDays } from 'date-fns'

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

export function subtractDays(days: number): string {
    return formatISO(subDays(new Date(), days), { representation: 'date' })
}

export function humanDay(date: string): string {
    return format(parseISO(date), 'dd. MMMM (EEEE)')
}
