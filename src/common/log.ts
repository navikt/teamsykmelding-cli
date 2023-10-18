import chalk, { backgroundColorNames, foregroundColorNames } from 'chalk'

// eslint-disable-next-line no-console
export const log = console.log

export const logProgressDot = (): void => {
    const color = foregroundColorNames[Math.floor(Math.random() * foregroundColorNames.length)]
    const bgColor = backgroundColorNames[Math.floor(Math.random() * backgroundColorNames.length)]
    process.stdout.write(chalk[bgColor][color]('.'))
}
