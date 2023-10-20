import autocomplete from 'inquirer-autocomplete-prompt'
import inquirer from 'inquirer'

inquirer.registerPrompt('autocomplete', autocomplete)

export default inquirer
