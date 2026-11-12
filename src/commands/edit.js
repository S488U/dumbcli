import chalk from 'chalk';
import prompts from 'prompts';
import { getStoragePaths, readCommands, writeCommands } from '../storage/store.js';
import { findCommandByIdOrAlias, validateAlias } from '../core/commands.js';

/**
 * Interactively edit an existing command's command text, alias, or comment.
 */
export const handleEditCommand = async (specifier, deps = {}) => {
  if (!specifier) {
    console.log(chalk.red('❌ Please provide the ID or Alias of the command to edit.'));
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

  const { command: cmdToEdit, index: internalIndex } = found;

  console.log(chalk.blue(`Editing command #${cmdToEdit.id} (${cmdToEdit.alias || 'no alias'}):`));
  console.log(`  Current Command: ${chalk.cyan(cmdToEdit.command)}`);
  console.log(`  Current Alias:   ${cmdToEdit.alias ? chalk.magenta(cmdToEdit.alias) : chalk.dim('-')}`);
  console.log(`  Current Comment: ${cmdToEdit.comment ? chalk.grey(cmdToEdit.comment) : chalk.dim('—')}`);

  const response = await promptFn([
    {
      type: 'text',
      name: 'newCommand',
      message: 'Enter the new command (leave blank to keep current)',
      initial: cmdToEdit.command,
    },
    {
      type: 'text',
      name: 'newAlias',
      message: 'Enter the new alias (unique, no spaces/colons, blank to keep, " " to clear)',
      initial: cmdToEdit.alias || '',
      validate: (value) => {
        if (value === ' ' || !value) return true;
        const newAlias = value.trim();
        if (newAlias.toLowerCase() === (cmdToEdit.alias || '').toLowerCase()) {
          return true;
        }
        return validateAlias(newAlias, commands, cmdToEdit.id);
      },
    },
    {
      type: 'text',
      name: 'newComment',
      message: 'Enter the new comment (leave blank to keep current, type " " to clear)',
      initial: cmdToEdit.comment || '',
    },
  ]);

  if (typeof response.newCommand === 'undefined') {
    console.log(chalk.yellow('⚠️ Edit canceled.'));
    return false;
  }

  let changed = false;
  const updatedCommand = response.newCommand.trim();
  const updatedAliasInput = response.newAlias ?? '';
  const updatedCommentInput = response.newComment ?? '';

  if (updatedCommand && updatedCommand !== cmdToEdit.command) {
    commands[internalIndex].command = updatedCommand;
    changed = true;
  }

  let finalAlias = cmdToEdit.alias;
  if (updatedAliasInput === ' ') {
    if (cmdToEdit.alias !== false) {
      finalAlias = false;
      changed = true;
    }
  } else if (updatedAliasInput.trim() && updatedAliasInput.trim() !== (cmdToEdit.alias || '')) {
    finalAlias = updatedAliasInput.trim();
    changed = true;
  }
  commands[internalIndex].alias = finalAlias;

  if (updatedCommentInput === ' ') {
    if (cmdToEdit.comment !== false) {
      commands[internalIndex].comment = false;
      changed = true;
    }
  } else if (updatedCommentInput.trim() && updatedCommentInput.trim() !== (cmdToEdit.comment || '')) {
    commands[internalIndex].comment = updatedCommentInput.trim();
    changed = true;
  }

  if (!changed) {
    console.log(chalk.yellow('ℹ️ No changes detected.'));
    return false;
  }

  if (commands[internalIndex].alias) {
    const aliasCheck = validateAlias(commands[internalIndex].alias, commands, cmdToEdit.id);
    if (aliasCheck !== true) {
      console.error(chalk.red(`❌ ${aliasCheck} Aborting.`));
      return false;
    }
  }

  writeCommands(commands, paths);
  console.log(chalk.green(`✔️ Command #${cmdToEdit.id} updated successfully.`));
  return true;
};
