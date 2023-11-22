export type CommandUsage = {
    usage: number
    argsUsage: Record<string, number>
}

export type Usage = Record<string, CommandUsage>

export type UserCommandUsage = {
    user: string
    usage: Usage
}

export type Command = string | number

export type Args = Record<string, unknown>
