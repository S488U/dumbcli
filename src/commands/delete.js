import chalk from 'chalk';
import prompts from 'prompts';
import { getStoragePaths, readCommands, writeCommands } from '../storage/store.js';
import { findCommandByIdOrAlias } from '../core/commands.js';

/**
 * Delete a saved command by ID or alias after confirmation.
 */
export const handleDeleteCommand = async (specifier, deps = {}) => {
  if (!specifier) {
    console.log(chalk.red('❌ Please provide the ID or Alias of the command to delete.'));
    return false;
  }

  const paths = deps.paths ?? getStoragePaths();
  const promptFn = deps.prompts ?? prompts;
  const commands = readCommands(paths);
  const found = findCommandByIdOrAlias(specifier, commands);

  if (!found) {
    console.log(chalk.red(`❌ Command with ID or Alias "${specifier}" not found.`));
    return false;
  }

  const { command: cmdToDelete, index: internalIndex } = found;
  const confirm = await promptFn({
    type: 'confirm',
    name: 'value',
    message: `Delete command #${cmdToDelete.id} (${cmdToDelete.alias || 'no alias'}): "${chalk.cyan(cmdToDelete.command)}"?`,
    initial: false,
  });

  if (!confirm.value) {
    console.log(chalk.yellow('⚠️ Deletion canceled.'));
    return false;
  }

  commands.splice(internalIndex, 1);
  writeCommands(commands, paths);
  console.log(chalk.green(`✔️ Command #${cmdToDelete.id} deleted successfully.`));
  return true;
};
