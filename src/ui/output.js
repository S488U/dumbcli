import chalk from 'chalk';
import Table from 'cli-table3';

export const BANNER_LOGO = `
██████╗ ██╗   ██╗███╗   ███╗███████╗╔██████╗██╗     ██╗
██╔══██╗██║   ██║████╗ ████║██╔══██║║██╔═══╝██║     ██║
██║  ██║██║   ██║██╔████╔██║███████║║██║    ██║     ██║
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║║██║    ██║     ██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║███████║╚██████╗███████╗██║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝╚══════╝╚═╝
`;

/**
 * Print the ASCII banner and tagline.
 */
export const printBanner = () => {
  console.log(chalk.cyan.bold(BANNER_LOGO));
  console.log(chalk.yellow.bold('      The "Dumb" Way to Manage Smart Commands\n'));
};

/**
 * Print the interactive welcome screen shown when `dumb` is invoked with no args.
 */
export const showWelcome = (configDir, version = '1.3.0') => {
  printBanner();
  console.log(chalk.green.bold(`👋 Welcome to DumbCLI! (v${version} - Now with IDs, Aliases & more!)`));
  console.log('   Manage your frequently used shell commands easily.');
  console.log('\n' + chalk.yellow('Common Commands:'));
  console.log('  - dumb add                 : Add a new command interactively');
  console.log('  - dumb ls                  : List all commands (shows ID, Alias)');
  console.log('  - dumb find "<query>"      : Search commands (ID, Alias, text, comment)');
  console.log('  - dumb run <id|alias> [args...] : Execute a command (use args for {})');
  console.log('  - dumb edit <id|alias>     : Edit a command');
  console.log('  - dumb dl <id|alias>       : Delete a command');
  console.log('  - dumb import [-a] <file>  : Import commands from JSON');
  console.log('  - dumb export [path]       : Export commands to JSON');
  console.log('\n' + chalk.cyan(chalk.red.bold('(Alpha)') + ' Power User Quick Add:'));
  console.log('  - d:a:<command>[:alias[:comment]]');
  console.log('\n' + chalk.dim('Use "dumb --help" for all commands and options.'));
  console.log(chalk.dim(`Config directory: ${configDir}`));
  console.log(`\nConnect with me on GitHub: ${chalk.blueBright('https://github.com/S488U')}`);
};

/**
 * Format saved commands as a terminal table string.
 */
export const renderCommandsTable = (commands) => {
  const table = new Table({
    head: [chalk.bold('ID'), chalk.bold('Alias'), chalk.bold('Command'), chalk.bold('Comment')],
    colWidths: [5, 15, 50, 30],
    wordWrap: true,
    style: { head: ['cyan'] },
  });

  const sortedCommands = [...commands].sort((a, b) => a.id - b.id);
  sortedCommands.forEach((cmd) => {
    table.push([
      chalk.yellow(cmd.id),
      cmd.alias ? chalk.magenta(cmd.alias) : chalk.dim('-'),
      chalk.white(cmd.command),
      cmd.comment ? chalk.grey(cmd.comment) : chalk.dim('—'),
    ]);
  });

  return table.toString();
};
