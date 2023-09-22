import chalk, { backgroundColorNames, foregroundColorNames } from 'chalk'

export const log = console.log

export const logProgressDot = () => {
    const color = foregroundColorNames[Math.floor(Math.random() * foregroundColorNames.length)]
    const bgColor = backgroundColorNames[Math.floor(Math.random() * backgroundColorNames.length)]
    process.stdout.write(chalk[bgColor][color]('.'))
}
