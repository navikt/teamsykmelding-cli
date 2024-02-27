import open from 'open'

export async function openUrl(url: string): Promise<void> {
    const isLinux = process.platform === 'linux'

    await open(url, { wait: isLinux })
}
