#!/usr/bin/env node

const yargs = require('yargs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const prompts = require('prompts');
const { exec, execSync } = require('child_process');
const Table = require('cli-table3');
const chalk = require('chalk').default;


// --- Define configuration location ---
const configDir = path.join(os.homedir(), '.dumbcli'); // Directory in user's home
const commandsFile = path.join(configDir, 'dumbcli.json'); // Full path to the file

// --- Helper function to ensure config directory exists ---
const ensureConfigDirExists = () => {
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
      // console.log(chalk.grey(`Created configuration directory: ${configDir}`));
    } catch (err) {
      console.error(chalk.red(`❌ Fatal Error: Could not create configuration directory at ${configDir}.`), err);
      console.error(chalk.red('   Please check permissions.'));
      process.exit(1); // Exit if we can't create the essential directory
    }
  }
};

// Helper function to read commands with improved error handling
const readCommands = () => {
  if (!fs.existsSync(commandsFile)) {
    return []; // File doesn't exist, return empty array is normal
  }
  try {
    const fileContent = fs.readFileSync(commandsFile, 'utf-8');
    // Handle empty file case
    if (fileContent.trim() === '') {
        return [];
    }
    return JSON.parse(fileContent);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(chalk.red(`❌ Error: Could not parse ${commandsFile}. It might be corrupted JSON.`));
    } else {
      console.error(chalk.red(`❌ Error reading commands file at ${commandsFile}:`), err);
    }
    // Decide if you want to exit or return empty array on error
    // Returning empty might hide problems, exiting might be safer
    console.error(chalk.yellow('   Returning empty command list due to error.'));
    return [];
  }
};

// Helper function to write commands with improved error handling
const writeCommands = (commands) => {
  ensureConfigDirExists(); // Ensure directory exists before writing
  try {
    fs.writeFileSync(commandsFile, JSON.stringify(commands, null, 2), 'utf-8');
  } catch (err) {
      console.error(chalk.red(`❌ Error writing commands file at ${commandsFile}:`), err);
      // Potentially exit here too if writing is critical
  }
};

// --- Commands ---

// Add command
yargs.command('add', 'Add a new command', {}, async () => {
  const response = await prompts([
    { type: 'text', name: 'command', message: 'Enter the full command' },
    { type: 'text', name: 'comment', message: 'Enter the comment (optional)', initial: '' } // Use empty string for clarity
  ]);

  if (response.command) {
    const commands = readCommands();
    // Use trim() to avoid storing just whitespace, handle empty comment correctly
    const comment = response.comment.trim() || false;
    commands.unshift({ command: response.command.trim(), comment: comment });
    writeCommands(commands);
    console.log(chalk.green('✔️ Command added successfully.'));
  } else {
    console.log(chalk.yellow('⚠️ Add command canceled.')); // More accurate than 'required' if user aborted
  }
});

// List command
yargs.command(['ls', 'list'], 'List all saved commands', () => {}, () => {
  const commands = readCommands();
  if (commands.length === 0) return console.log(chalk.yellow('ℹ️ No commands saved yet. Use "dumb add" to add one.'));

  const table = new Table({
      head: [chalk.bold('Index'), chalk.bold('Command'), chalk.bold('Comment')],
      colWidths: [7, 50, 30], // Adjusted widths slightly
      wordWrap: true,
      style: { head: ['cyan']}
     });

  commands.forEach((cmd, index) => {
    // Display index from 1 upwards, corresponding to user input for dl/run/edit
    const displayIndex = commands.length - index;
    table.push([displayIndex, chalk.white(cmd.command), cmd.comment ? chalk.grey(cmd.comment) : chalk.dim('—')]);
  });

  console.log(table.toString());
});

// Delete command
yargs.command('dl <index>', 'Delete a saved command', (yargs) => {
  yargs.positional('index', { describe: 'Index of the command to delete (from "ls")', type: 'number' });
}, async (argv) => {
  const commands = readCommands();
  // Calculate the actual array index (0-based, reversed)
  const internalIndex = commands.length - argv.index;

  if (internalIndex < 0 || internalIndex >= commands.length || !Number.isInteger(argv.index) || argv.index <= 0) {
     return console.log(chalk.red(`❌ Invalid index: ${argv.index}. Use "dumb ls" to see valid indices.`));
  }

  const commandToDelete = commands[internalIndex];
  const confirm = await prompts({
    type: 'confirm',
    name: 'value',
    message: `Delete command #${argv.index}: "${chalk.cyan(commandToDelete.command)}"?`,
    initial: false
   });

  if (confirm.value) {
    commands.splice(internalIndex, 1);
    writeCommands(commands);
    console.log(chalk.green(`✔️ Command at index ${argv.index} deleted successfully.`));
  } else {
    console.log(chalk.yellow('⚠️ Deletion canceled.'));
  }
});

// Edit Command - NEW
yargs.command('edit <index>', 'Edit a saved command or its comment', (yargs) => {
    yargs.positional('index', { describe: 'Index of the command to edit (from "ls")', type: 'number' });
}, async (argv) => {
    const commands = readCommands();
    const internalIndex = commands.length - argv.index; // Calculate the actual array index

    if (internalIndex < 0 || internalIndex >= commands.length || !Number.isInteger(argv.index) || argv.index <= 0) {
        return console.log(chalk.red(`❌ Invalid index: ${argv.index}. Use "dumb ls" to see valid indices.`));
    }

    const commandToEdit = commands[internalIndex];

    console.log(chalk.blue(`Editing command #${argv.index}:`));
    console.log(`  Current Command: ${chalk.cyan(commandToEdit.command)}`);
    console.log(`  Current Comment: ${commandToEdit.comment ? chalk.grey(commandToEdit.comment) : chalk.dim('—')}`);

    const response = await prompts([
        {
            type: 'text',
            name: 'newCommand',
            message: 'Enter the new command (leave blank to keep current)',
            initial: commandToEdit.command // Pre-fill with current value
        },
        {
            type: 'text',
            name: 'newComment',
            message: 'Enter the new comment (leave blank to keep current, type " " to clear)',
             // Pre-fill, handle false case for prompt
            initial: commandToEdit.comment || ''
        }
    ]);

    // Check if user provided input (prompts returns {} if aborted with Ctrl+C)
    if (typeof response.newCommand === 'undefined' || typeof response.newComment === 'undefined') {
        return console.log(chalk.yellow('⚠️ Edit canceled.'));
    }

    // Update values if they were changed
    let changed = false;
    const updatedCommand = response.newCommand.trim();
    const updatedCommentInput = response.newComment; // Don't trim space meant for clearing

    if (updatedCommand && updatedCommand !== commandToEdit.command) {
        commands[internalIndex].command = updatedCommand;
        changed = true;
    }

    // Handle comment update: allow clearing, setting, or keeping
    if (updatedCommentInput === ' ' && commandToEdit.comment !== false) { // Clear comment
        commands[internalIndex].comment = false;
        changed = true;
    } else if (updatedCommentInput.trim() && updatedCommentInput.trim() !== commandToEdit.comment) { // Set new comment
         commands[internalIndex].comment = updatedCommentInput.trim();
         changed = true;
     } else if (updatedCommentInput === '' && commandToEdit.comment !== false && commandToEdit.comment !== '') {
        // User entered blank, but didn't explicitly clear with ' ' -> keep current
         // No change needed here
     } else if (updatedCommentInput === '' && commandToEdit.comment === false) {
         // Kept blank, was already false
         // No change needed
     }


    if (changed) {
        writeCommands(commands);
        console.log(chalk.green(`✔️ Command at index ${argv.index} updated successfully.`));
    } else {
        console.log(chalk.yellow('ℹ️ No changes detected.'));
    }
});


// Find command - Case Insensitive
yargs.command('find <query>', 'Find saved commands (case-insensitive)', (yargs) => {
  yargs.positional('query', { describe: 'Text to search in commands or comments', type: 'string' });
}, (argv) => {
  const commands = readCommands();
  const queryLower = argv.query.toLowerCase(); // Convert query to lowercase once

  const results = commands.filter(cmd =>
      cmd.command.toLowerCase().includes(queryLower) ||
      (cmd.comment && cmd.comment.toLowerCase().includes(queryLower)) // Check comment exists and compare lowercase
  );

  if (results.length === 0) return console.log(chalk.yellow(`ℹ️ No commands found matching "${argv.query}".`));

  console.log(chalk.blue(`🔍 Found ${results.length} command(s) matching "${argv.query}":`));
  // Find the original indices for display
  const resultsWithIndices = results.map(cmd => {
      const originalIndex = commands.findIndex(originalCmd => originalCmd === cmd);
      return { ...cmd, displayIndex: commands.length - originalIndex };
  });

  resultsWithIndices.forEach(cmd => {
    console.log(`\n[${chalk.cyan(cmd.displayIndex)}] 📌 ${chalk.white(cmd.command)}`);
    if (cmd.comment) console.log(`      💬 ${chalk.grey(cmd.comment)}`);
  });
});

// Run command
yargs.command('run <index>', 'Execute a saved command', (yargs) => {
  yargs.positional('index', { describe: 'Index of the command to execute (from "ls")', type: 'number' });
}, async (argv) => {
  const commands = readCommands();
  const internalIndex = commands.length - argv.index; // Calculate the actual array index

  if (internalIndex < 0 || internalIndex >= commands.length || !Number.isInteger(argv.index) || argv.index <= 0) {
    return console.log(chalk.red(`❌ Invalid index: ${argv.index}. Use "dumb ls" to see valid indices.`));
  }

  const commandToRunObj = commands[internalIndex];
  const commandToRun = commandToRunObj.command.replace(/^~(?=$|\/)/, os.homedir()); // More robust tilde replacement

  const confirm = await prompts({
      type: 'confirm',
      name: 'value',
      message: `Run command #${argv.index}: "${chalk.cyan(commandToRun)}"?`,
      initial: true
    });

  if (!confirm.value) return console.log(chalk.yellow('⚠️ Execution canceled.'));

  try {
    console.log(chalk.green(`🚀 Running [${argv.index}]: ${commandToRun}`));
    // Using execSync: Blocks until command completes. Simple for many use cases.
    // If you need to run long background tasks or process streams live,
    // consider using the asynchronous `exec` or `spawn` from child_process.
    execSync(commandToRun, { stdio: 'inherit', encoding: 'utf-8', shell: process.env.SHELL || true }); // Use user's shell if possible
    console.log(chalk.green(`✅ Command [${argv.index}] finished.`)); // Success indication
  } catch (error) {
    // execSync throws an error on non-zero exit code.
    // stderr is already shown via stdio: 'inherit'. We just indicate failure.
    console.log(chalk.red(`❌ Command [${argv.index}] failed.`));
    // Log the exit code if available (often useful)
    if (typeof error.status === 'number') { // Check if status is a number
        console.log(chalk.red(`   Exit code: ${error.status}`));
    }
    // Avoid logging error.message as it often duplicates output already seen.
  }
});


// Dump command
yargs.command('dump', 'Show raw data from dumbcli.json', () => {}, () => { // Simplified command name
  console.log(chalk.magenta(`📂 Raw data from ${commandsFile}:`));
  try {
      // Read raw to avoid parsing if it's corrupted
      const rawData = fs.existsSync(commandsFile) ? fs.readFileSync(commandsFile, 'utf-8') : '[]';
      console.log(rawData);
  } catch (err) {
      console.error(chalk.red(`❌ Error reading raw data from ${commandsFile}:`), err);
  }
});

// --- Yargs Setup ---

yargs.version('1.2.0') // Updated version number
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .wrap(yargs.terminalWidth()) // Adjust help text width to terminal
    .strict() // Report unrecognized commands/options
    .demandCommand(1, chalk.red('❌ Please specify a command. Use --help for options.')) // Require at least one command
    .recommendCommands() // Suggest commands on typo
    .epilog(`For more help, visit: ${chalk.blueBright('https://github.com/S488U')}`) // Example epilog
    .example('dumb add', 'Add a new command interactively.')
    .example('dumb ls', 'List all stored commands.')
    .example('dumb find "docker"', 'Search commands/comments for "docker".')
    .example('dumb run 5', 'Execute the command with index 5.')
    .example('dumb edit 3', 'Edit the command or comment for index 3.') // Added example
    .example('dumb dl 8', 'Delete the command with index 8.');


// Show welcome message ONLY when no command/args are passed correctly
// This relies on demandCommand handling the case where *no* command is given.
// We add a specific check for just `dumb` being run.
if (process.argv.length === 2 && process.stdin.isTTY) {
  console.log(chalk.green.bold('👋 Welcome to DumbCLI!'));
  console.log('   Manage your frequently used shell commands easily.');
  console.log('\n' + chalk.yellow('Common Commands:'));
  console.log('  - dumb add          : Add a new command');
  console.log('  - dumb ls           : List all commands');
  console.log('  - dumb find "<query>" : Search commands (case-insensitive)');
  console.log('  - dumb run <index>  : Execute a command by its index');
  console.log('  - dumb edit <index> : Edit a command by its index');
  console.log('  - dumb dl <index>   : Delete a command by its index');
  console.log('\n' + chalk.dim(`Use "dumb --help" for all commands and options.`));
  console.log(chalk.dim(`Commands are stored in: ${commandsFile}`));
  console.log(`\nConnect with me on GitHub: ${chalk.blueBright('https://github.com/S488U')}`);
  process.exit(0);
}


// Parse CLI arguments & Trigger command execution
// Errors for unknown commands are now handled by yargs.strict() and demandCommand()
yargs.parse();