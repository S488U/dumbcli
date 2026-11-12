import chalk from 'chalk';
import { getStoragePaths, readCommands } from '../storage/store.js';
import { filterCommands } from '../core/commands.js';

/**
 * Search commands by ID, alias, command text, or comment.
 */
export const handleFindCommand = (query, deps = {}) => {
  if (!query) {
    console.log(chalk.red('❌ Please provide a search query.'));
    return [];
  }

  const paths = deps.paths ?? getStoragePaths();
  const commands = readCommands(paths);
  const results = filterCommands(commands, query);

  if (results.length === 0) {
    console.log(chalk.yellow(`ℹ️ No commands found matching "${query}".`));
    return [];
  }

  console.log(chalk.blue(`🔍 Found ${results.length} command(s) matching "${query}":`));
  results.forEach((cmd) => {
    console.log(`\n[${chalk.yellow(cmd.id)}] ${cmd.alias ? chalk.magenta(`(${cmd.alias})`) : ''} 📌 ${chalk.white(cmd.command)}`);
    if (cmd.comment) console.log(`      💬 ${chalk.grey(cmd.comment)}`);
  });

  return results;
};
