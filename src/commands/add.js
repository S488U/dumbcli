import chalk from 'chalk';
import prompts from 'prompts';
import { getNextId, getStoragePaths, readCommands, writeCommands } from '../storage/store.js';
import { validateAlias } from '../core/commands.js';

/**
 * Interactively add a new command (supports prefilled values from power-add syntax).
 */
export const handleAddCommand = async (
  initialCommand = '',
  initialAlias = '',
  initialComment = '',
  deps = {}
) => {
  const paths = deps.paths ?? getStoragePaths();
  const promptFn = deps.prompts ?? prompts;
  const commands = readCommands(paths);

  const response = await promptFn([
    {
      type: 'text',
      name: 'command',
      message: 'Enter the full command (use {} for dynamic parts)',
      initial: initialCommand,
      validate: (value) => (value.trim() ? true : 'Command cannot be empty.'),
    },
    {
      type: 'text',
      name: 'alias',
      message: 'Enter a short alias (optional, unique, no spaces/colons)',
      initial: initialAlias,
      validate: (value) => validateAlias(value, commands),
    },
    {
      type: 'text',
      name: 'comment',
      message: 'Enter a comment (optional)',
      initial: initialComment,
    },
  ]);

  if (!response.command || !response.command.trim()) {
    console.log(chalk.yellow('⚠️ Add command canceled.'));
    return null;
  }

  const alias = response.alias?.trim() || false;
  const comment = response.comment?.trim() || false;

  const aliasCheck = validateAlias(alias || '', commands);
  if (alias && aliasCheck !== true) {
    console.error(chalk.red(`❌ ${aliasCheck} Aborting.`));
    return null;
  }

  const newId = getNextId(paths, commands);
  const newCommand = {
    id: newId,
    command: response.command.trim(),
    alias,
    comment,
  };

  commands.push(newCommand);
  writeCommands(commands, paths);
  console.log(chalk.green(`✔️ Command added successfully (ID: ${newId}${alias ? `, Alias: ${alias}` : ''}).`));
  return newCommand;
};
