import yargs from 'yargs/yargs';
import chalk from 'chalk';
import { ensureConfigDirExists, getStoragePaths, readCommands } from './storage/store.js';
import { findCommandByIdOrAlias, parsePowerAddInput, RESERVED_COMMAND_NAMES } from './core/commands.js';
import { showWelcome } from './ui/output.js';
import { handleAddCommand } from './commands/add.js';
import { handleListCommands } from './commands/list.js';
import { handleDeleteCommand } from './commands/delete.js';
import { handleEditCommand } from './commands/edit.js';
import { handleFindCommand } from './commands/find.js';
import { handleRunCommand } from './commands/run.js';
import { handleDumpCommand } from './commands/dump.js';
import { handleExportCommand } from './commands/export.js';
import { handleImportCommand } from './commands/import.js';

export const CLI_VERSION = '1.3.0';

/**
 * Configure and return the yargs CLI parser.
 */
export const buildCli = (argv, deps = {}) => {
  const paths = deps.paths ?? getStoragePaths();
  const cmdDeps = { ...deps, paths };

  const cli = yargs(argv)
    .scriptName('dumb')
    .exitProcess(deps.exitProcess ?? true);

  cli.command('add', 'Add a new command interactively', {}, () => handleAddCommand('', '', '', cmdDeps));

  cli.command(['ls', 'list'], 'List all saved commands', {}, () => handleListCommands(cmdDeps));

  cli.command(
    'dl <specifier>',
    'Delete a command by ID or Alias',
    (cmdYargs) => {
      cmdYargs.positional('specifier', { describe: 'ID or Alias of the command to delete', type: 'string' });
    },
    (parsed) => handleDeleteCommand(parsed.specifier, cmdDeps)
  );

  cli.command(
    'edit <specifier>',
    'Edit a command by ID or Alias',
    (cmdYargs) => {
      cmdYargs.positional('specifier', { describe: 'ID or Alias of the command to edit', type: 'string' });
    },
    (parsed) => handleEditCommand(parsed.specifier, cmdDeps)
  );

  cli.command(
    'find <query>',
    'Find commands by ID, Alias, Command, or Comment (case-insensitive)',
    (cmdYargs) => {
      cmdYargs.positional('query', { describe: 'Text to search for', type: 'string' });
    },
    (parsed) => handleFindCommand(parsed.query, cmdDeps)
  );

  cli.command(
    ['run <specifier> [args..]', 'r <specifier> [args..]'],
    'Execute a command by ID or Alias (pass arguments for dynamic commands)',
    (cmdYargs) => {
      cmdYargs.positional('specifier', { describe: 'ID or Alias of the command to run', type: 'string' });
      cmdYargs.positional('args', {
        describe: 'Arguments to pass to the command (for {} placeholders)',
        type: 'string',
        array: true,
      });
    },
    (parsed) => handleRunCommand(parsed.specifier, parsed.args, cmdDeps)
  );

  cli.command('dump', 'Show raw data from dumbcli.json', {}, () => handleDumpCommand(cmdDeps));

  cli.command(
    'export [path]',
    'Export all commands to a JSON file',
    (cmdYargs) => {
      cmdYargs.positional('path', {
        describe: 'Optional directory path to export the file to (defaults to current)',
        type: 'string',
      });
    },
    (parsed) => handleExportCommand(parsed.path, cmdDeps)
  );

  cli.command(
    'import <file>',
    'Import commands from a JSON file',
    (cmdYargs) => {
      cmdYargs.positional('file', {
        describe: 'Path to the JSON file to import',
        type: 'string',
        demandOption: true,
      });
      cmdYargs.option('a', {
        alias: 'append',
        describe: 'Append imported commands instead of replacing existing ones',
        type: 'boolean',
        default: false,
      });
    },
    (parsed) => handleImportCommand(parsed.file, parsed.append, cmdDeps)
  );

  cli.command(
    '$0 <input..>',
    false,
    (cmdYargs) => {
      cmdYargs.positional('input', { type: 'string', array: true });
    },
    async (parsed) => {
      const rawInput = (parsed.input || []).join(' ');
      const powerAdd = parsePowerAddInput(rawInput);

      if (powerAdd) {
        console.log(chalk.cyan('⚡ Power Add detected...'));
        await handleAddCommand(powerAdd.command, powerAdd.alias, powerAdd.comment, cmdDeps);
        return;
      }

      if (!parsed.strict && parsed.input?.length > 0) {
        const commands = readCommands(paths);
        if (findCommandByIdOrAlias(parsed.input[0], commands)) {
          await handleRunCommand(parsed.input[0], parsed.input.slice(1), cmdDeps);
          return;
        }
      }

      console.error(chalk.red(`❌ Unknown command: "${rawInput}"`));
      console.log(chalk.dim('Use "dumb --help" to see all available commands.'));
      if (deps.exitProcess !== false) {
        process.exitCode = 1;
      }
    }
  );

  return cli
    .option('strict', {
      describe: 'Disable implicit command execution (require explicit "run")',
      type: 'boolean',
      default: false,
    })
    .version(CLI_VERSION)
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .wrap(cli.terminalWidth())
    .strict()
    .recommendCommands()
    .epilog(`For more help, visit: ${chalk.blueBright('https://github.com/S488U')}`)
    .example('dumb add', 'Add a new command interactively.')
    .example('dumb ls', 'List all stored commands.')
    .example('dumb find "docker"', 'Search commands/comments/aliases for "docker".')
    .example('dumb 5', 'Implicitly run the command with ID 5.')
    .example('dumb deploy-app', 'Implicitly run the command with alias "deploy-app".')
    .example('dumb run build assets/style.css public/style.css', 'Run command "build" with arguments.')
    .example('dumb edit 3', 'Edit the command with ID 3.')
    .example('dumb edit fix-db', 'Edit the command with alias "fix-db".')
    .example('dumb dl 8', 'Delete the command with ID 8.')
    .example('dumb import my_commands.json', 'Import commands, replacing existing ones.')
    .example('dumb import -a shared_commands.json', 'Append commands from a file.')
    .example('dumb export ./backups', 'Export commands to the backups folder.')
    .example('d:a:echo "Hello World":hello:Simple echo', 'Quickly add a command.');
};

/**
 * Run DumbCLI for the provided argv array.
 */
export const runCli = async (argv, deps = {}) => {
  const paths = deps.paths ?? getStoragePaths();
  ensureConfigDirExists(paths);

  const isTTY = deps.isTTY ?? Boolean(process.stdin.isTTY);
  const cmdDeps = { ...deps, paths };
  const cli = buildCli(argv, cmdDeps);

  if (argv.length === 0) {
    if (isTTY) {
      showWelcome(paths.configDir, CLI_VERSION);
    } else {
      cli.showHelp();
    }
    return;
  }

  const firstArg = argv[0];
  if ((firstArg === 'run' || firstArg === 'r') && argv[1] && !argv[1].startsWith('-')) {
    return handleRunCommand(argv[1], argv.slice(2), cmdDeps);
  }

  if (
    !firstArg.startsWith('-') &&
    !RESERVED_COMMAND_NAMES.has(firstArg.toLowerCase()) &&
    !parsePowerAddInput(argv.join(' '))
  ) {
    const commands = readCommands(paths);
    if (findCommandByIdOrAlias(firstArg, commands)) {
      return handleRunCommand(firstArg, argv.slice(1), cmdDeps);
    }
  }

  return cli.parseAsync();
};
