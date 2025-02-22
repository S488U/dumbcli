#!/usr/bin/env node
const yargs = require('yargs');
const fs = require('fs');
const prompts = require('prompts');
const { exec } = require('child_process');
const Table = require('cli-table3');
const chalk = require('chalk').default;


// File to store commands
const commandsFile = './commands.json';

// Helper function to read commands
const readCommands = () => (fs.existsSync(commandsFile) ? JSON.parse(fs.readFileSync(commandsFile, 'utf-8')) : []);

// Helper function to write commands
const writeCommands = (commands) => fs.writeFileSync(commandsFile, JSON.stringify(commands, null, 2));

// Command to add a new command
yargs.command('add', 'Add a new command', {}, async () => {
  const response = await prompts([
    { type: 'text', name: 'command', message: 'Enter the full command' },
    { type: 'text', name: 'comment', message: 'Enter the comment (optional)', initial: false }
  ]);

  if (response.command) {
    const commands = readCommands();
    commands.unshift({ command: response.command, comment: response.comment || false });
    writeCommands(commands);
    console.log(chalk.green('✔️ Command added successfully.'));
  } else {
    console.log(chalk.red('❌ Command is required.'));
  }
});

// List all saved commands with colored output
yargs.command(['ls', 'list'], 'List all saved commands', () => {}, () => {
  const commands = readCommands();
  if (commands.length === 0) return console.log(chalk.red('❌ No commands saved.'));

  const table = new Table({ head: ['Index', 'Command', 'Comment'], colWidths: [6, 40, 30], wordWrap: true });
  commands.forEach((cmd, index) => {
    table.push([commands.length - index, chalk.cyan(cmd.command), cmd.comment !== false ? cmd.comment : '—']);
  });

  console.log(table.toString());
});

// Delete a command with confirmation
yargs.command('dl <index>', 'Delete a saved command', (yargs) => {
  yargs.positional('index', { describe: 'Index of the command to delete', type: 'number' });
}, async (argv) => {
  const commands = readCommands();
  const index = commands.length - argv.index;
  if (index < 0 || index >= commands.length) return console.log(chalk.red('❌ Invalid index.'));

  const confirm = await prompts({ type: 'confirm', name: 'value', message: `Delete "${commands[index].command}"?`, initial: false });
  if (confirm.value) {
    commands.splice(index, 1);
    writeCommands(commands);
    console.log(chalk.green(`✔️ Command at index ${argv.index} deleted successfully.`));
  } else {
    console.log(chalk.yellow('⚠️ Deletion canceled.'));
  }
});

// Find saved commands with better search
yargs.command('find <query>', 'Find saved commands', (yargs) => {
  yargs.positional('query', { describe: 'Text to search in commands', type: 'string' });
}, (argv) => {
  const commands = readCommands();
  const results = commands.filter(cmd => cmd.command.includes(argv.query) || (cmd.comment !== false && cmd.comment.includes(argv.query)));

  if (results.length === 0) return console.log(chalk.red('❌ No matching commands found.'));
  
  console.log(chalk.blue(`🔍 Found ${results.length} result(s):`));
  results.forEach(cmd => {
    console.log(`\n📌 Command: ${chalk.cyan(cmd.command)}`);
    if (cmd.comment !== false) console.log(`💬 Comment: ${chalk.yellow(cmd.comment)}`);
  });
});

// Execute a command with confirmation
yargs.command('run <index>', 'Execute a saved command', (yargs) => {
  yargs.positional('index', { describe: 'Index of the command to execute', type: 'number' });
}, async (argv) => {
  const commands = readCommands();
  const index = commands.length - argv.index;
  if (index < 0 || index >= commands.length) return console.log(chalk.red('❌ Invalid index.'));

  const confirm = await prompts({ type: 'confirm', name: 'value', message: `Run "${commands[index].command}"?`, initial: true });
  if (!confirm.value) return console.log(chalk.yellow('⚠️ Execution canceled.'));

  console.log(chalk.green(`🚀 Running: ${commands[index].command}`));
  exec(commands[index].command, (error, stdout, stderr) => {
    if (error) return console.log(chalk.red(`❌ Error: ${error.message}`));
    if (stderr) console.log(chalk.yellow(`⚠️ ${stderr}`));
    console.log(stdout);
  });
});

// Dump raw command data
yargs.command('dump cmd', 'Show raw commands.json data', () => {}, () => {
  console.log(chalk.magenta('📂 Raw data from commands.json:'));
  console.log(readCommands());
});

// Fix `-v` not working
yargs.version('1.0.0').alias('v', 'version');

// Improved help menu
yargs.help().alias('h', 'help').example('dumb add', 'Add a new command').example('dumb find "ollama"', 'Search for a command related to "ollama"');

// Custom welcome message
yargs.command('*', 'Show welcome message and GitHub link', () => {
  if (yargs.argv._.length === 0) {
    console.log(chalk.green('👋 Welcome to DumbCLI!'));
    console.log('  - `dumb add` to add a new command');
    console.log('  - `dumb find "<query>"` to search commands');
    console.log('  - `dumb ls` to list all commands');
    console.log('  - `dumb run <index>` to execute a saved command');
    console.log(`\nConnect with me on GitHub: ${chalk.blue('https://github.com/S488U')}`);
  }
}, () => {});

// Parse CLI arguments
yargs.parse();
