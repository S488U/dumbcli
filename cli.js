#!/usr/bin/env node
const yargs = require('yargs');
const fs = require('fs');
const prompts = require('prompts');
const { exec } = require('child_process');
const Table = require('cli-table3');

// File to store commands
const commandsFile = './commands.json';

// Helper function to read commands from the file
const readCommands = () => {
  if (!fs.existsSync(commandsFile)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(commandsFile, 'utf-8'));
};

// Helper function to write commands to the file
const writeCommands = (commands) => {
  fs.writeFileSync(commandsFile, JSON.stringify(commands, null, 2));
};

// Command to add a new command
yargs.command('add', 'Add a new command', {}, async () => {
  const response = await prompts([
    {
      type: 'text',
      name: 'command',
      message: 'Enter the full command'
    },
    {
      type: 'text',
      name: 'comment',
      message: 'Enter the comment (optional)',
      initial: false
    },
  ]);

  if (response.command) {
    const commands = readCommands();
    const newCommand = {
      command: response.command,
      comment: response.comment || false
    };
    commands.unshift(newCommand);
    writeCommands(commands);
    console.log('✔️ Command added successfully.');
  } else {
    console.log('❌ Command is required.');
  }
});

// Command to list all saved commands with fixed-width table
yargs.command(['ls', 'list'], 'List all saved commands', () => {}, () => {
  const commands = readCommands();

  if (commands.length === 0) {
    console.log('❌ No commands saved.');
    return;
  }

  const table = new Table({
    head: ['Index', 'Command', 'Comment'],
    colWidths: [6, 40, 30], // Fixed widths for columns
    wordWrap: true // Allow wrapping of long text
  });

  commands.forEach((cmd, index) => {
    table.push([commands.length - index, cmd.command, cmd.comment !== false ? cmd.comment : '—']);
  });

  console.log(table.toString());
});

// Command to delete a saved command
yargs.command('dl <index>', 'Delete a saved command', (yargs) => {
  yargs.positional('index', {
    describe: 'Index of the command to delete',
    type: 'number'
  });
}, (argv) => {
  const commands = readCommands();
  const index = commands.length - argv.index;

  if (index < 0 || index >= commands.length) {
    console.log('❌ Invalid index.');
    return;
  }

  commands.splice(index, 1);
  writeCommands(commands);
  console.log(`✔️ Command at index ${argv.index} deleted successfully.`);
});

// Command to find saved commands by search query
yargs.command('find <query>', 'Find saved commands', (yargs) => {
  yargs.positional('query', {
    describe: 'Text to search in commands',
    type: 'string'
  });
}, (argv) => {
  const commands = readCommands();
  const results = commands.filter(cmd =>
    cmd.command && cmd.command.includes(argv.query) || 
    (cmd.comment !== false && cmd.comment && cmd.comment.includes(argv.query))
  );

  if (results.length === 0) {
    console.log('❌ No matching commands found.');
    return;
  }

  console.log(`🔍 Found ${results.length} result(s):`);
  results.forEach((cmd, index) => {
    console.log(`\n📌 Command: ${cmd.command}`);
    if (cmd.comment !== false) console.log(`💬 Comment: ${cmd.comment}`);
  });
});

// Command to execute a saved command
yargs.command('run <index>', 'Execute a saved command', (yargs) => {
  yargs.positional('index', {
    describe: 'Index of the command to execute',
    type: 'number'
  });
}, (argv) => {
  const commands = readCommands();
  const index = commands.length - argv.index;

  if (index < 0 || index >= commands.length) {
    console.log('❌ Invalid index.');
    return;
  }

  console.log(`🚀 Running: ${commands[index].command}`);
  exec(commands[index].command, (error, stdout, stderr) => {
    if (error) {
      console.log(`❌ Error: ${error.message}`);
      return;
    }
    if (stderr) console.log(`⚠️ ${stderr}`);
    console.log(stdout);
  });
});

// Command to show raw commands data
yargs.command('dump cmd', 'Show raw commands.json data', () => {}, () => {
  const commands = readCommands();
  console.log('Raw data from commands.json:');
  console.log(commands);
});

// Show version
yargs.version('1.0.0'); // This will fix the version issue

// Show help menu with examples
yargs.help('help', 'Show this help menu with available commands')
  .alias('h', 'help')
  .example('dumb add', 'Add a new command')
  .example('dumb find "ollama"', 'Search for a command related to "ollama"')
  .showHelpOnFail(false); // Prevent the welcome message from showing during help

// Prevent the welcome message from showing in `-v` or `--version`
yargs.command('*', 'Show welcome message and GitHub link', () => {
  if (yargs.argv._.length === 0) { // Only show the welcome message if no command is specified
    console.log('👋 Welcome to DumbCLI!');
    console.log('Here are some quick commands to get started:');
    console.log('  - `dumb add` to add a new command');
    console.log('  - `dumb find "<query>"` to search commands');
    console.log('  - `dumb ls` to list all commands');
    console.log('  - `dumb run <index>` to execute a saved command');
    console.log('\nConnect with me on GitHub: https://github.com/S488U');
  }
}, () => {});

// Handle unknown commands with custom error message
yargs.fail((msg, err) => {
  console.log('❌ Error: Unknown command.');
  yargs.showHelp();
});

// Parse the arguments
yargs.parse();
