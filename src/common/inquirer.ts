import inquirer from 'inquirer'

/**
 * Sometimes when inquirer propmts are invoked back to back, the second prompt
 * will not be able to receive input. This is a hacky workaround to fix that.
 */
export async function hackilyFixBackToBackPrompt(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 369))
}

export default inquirer
