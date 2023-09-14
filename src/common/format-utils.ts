import crypto from 'crypto'
import chalk, { backgroundColorNames } from 'chalk'

export function authorToColorAvatar(username: string) {
    const hash = crypto.createHash('md5').update(username).digest('hex').slice(-6)
    const index = parseInt(hash, 16) % backgroundColorNames.length

    return chalk[backgroundColorNames[index]]('  ')
}
