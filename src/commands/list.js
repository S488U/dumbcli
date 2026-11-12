import chalk from 'chalk';
import { getStoragePaths, readCommands } from '../storage/store.js';
import { renderCommandsTable } from '../ui/output.js';

/**
 * Display all saved commands in a formatted table.
 */
export const handleListCommands = (deps = {}) => {
  const paths = deps.paths ?? getStoragePaths();
  const commands = readCommands(paths);

  if (commands.length === 0) {
    console.log(chalk.yellow('ℹ️ No commands saved yet. Use "dumb add" to add one.'));
    return [];
  }

  console.log(renderCommandsTable(commands));
  return commands;
};
