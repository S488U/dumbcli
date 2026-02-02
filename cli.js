#!/usr/bin/env node

import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import path from 'path';
import os from 'os';
import prompts from 'prompts';
import { execSync } from 'child_process';
import Table from 'cli-table3';
import chalk from 'chalk'

const dumb = yargs(hideBin(process.argv));

// --- Configuration ---
const configDir = path.join(os.homedir(), '.dumbcli');
const commandsFile = path.join(configDir, 'dumbcli.json');
const configFilePath = path.join(configDir, 'config.json'); // For storing next ID

// --- Helper Functions ---

const ensureConfigDirExists = () => {
  if (!fs.existsSync(configDir)) {
    try {
      fs.mkdirSync(configDir, { recursive: true });
    } catch (err) {
      console.error(chalk.red(`❌ Fatal Error: Could not create configuration directory at ${configDir}.`), err);
      process.exit(1);
    }
  }
};

// Read/Write Config (for next ID)
const readConfig = () => {
    ensureConfigDirExists();
    if (!fs.existsSync(configFilePath)) {
        return { nextId: 1 }; // Start IDs from 1
    }
    try {
        const data = fs.readFileSync(configFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        console.error(chalk.red(`❌ Error reading config file ${configFilePath}. Using defaults.`), err);
        return { nextId: 1 };
    }
};

const writeConfig = (config) => {
    ensureConfigDirExists();
    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (err) {
        console.error(chalk.red(`❌ Error writing config file ${configFilePath}.`), err);
    }
};


// Read/Write Commands (now with ID and Alias)
const readCommands = () => {
  ensureConfigDirExists(); // Ensure dir exists first
  if (!fs.existsSync(commandsFile)) {
    return [];
  }
  try {
    const fileContent = fs.readFileSync(commandsFile, 'utf-8');
    if (fileContent.trim() === '') {
        return [];
    }
    const commands = JSON.parse(fileContent);
    // Basic validation: ensure it's an array
    if (!Array.isArray(commands)) {
        console.error(chalk.red(`❌ Error: ${commandsFile} does not contain a valid JSON array.`));
        console.error(chalk.yellow('   Returning empty command list. Consider backing up and fixing the file.'));
        return [];
    }
    // Ensure essential fields exist (provide defaults if upgrading from old format)
    return commands.map((cmd, index) => ({
        id: cmd.id || index + 1, // Assign basic ID if missing (for migration)
        alias: cmd.alias || false,
        command: cmd.command || 'INVALID_COMMAND',
        comment: cmd.comment || false,
        // We might add `createdAt` later
    }));
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(chalk.red(`❌ Error: Could not parse ${commandsFile}. It might be corrupted JSON.`));
    } else {
      console.error(chalk.red(`❌ Error reading commands file at ${commandsFile}:`), err);
    }
    console.error(chalk.yellow('   Returning empty command list due to error.'));
    return [];
  }
};

const writeCommands = (commands) => {
  ensureConfigDirExists();
  try {
    // Sort commands by ID for consistency in the file (optional but nice)
    const sortedCommands = commands.sort((a, b) => a.id - b.id);
    fs.writeFileSync(commandsFile, JSON.stringify(sortedCommands, null, 2), 'utf-8');
  } catch (err) {
      console.error(chalk.red(`❌ Error writing commands file at ${commandsFile}:`), err);
  }
};

// Helper to find a command by ID or Alias
const findCommandByIdOrAlias = (specifier, commands) => {
    const searchLower = String(specifier).toLowerCase(); // Ensure string comparison
    const idSearch = parseInt(specifier, 10); // Attempt to parse as ID

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        // Check ID first if specifier is a valid number
        if (!isNaN(idSearch) && cmd.id === idSearch) {
            return { command: cmd, index: i };
        }
        // Then check alias (case-insensitive)
        if (cmd.alias && cmd.alias.toLowerCase() === searchLower) {
             return { command: cmd, index: i };
        }
    }
    return null; // Not found
};

// Helper to check Alias uniqueness
const isAliasUnique = (alias, commands, excludeId = null) => {
    if (!alias) return true; // Empty/false alias is always "unique"
    const aliasLower = alias.toLowerCase();
    return !commands.some(cmd =>
        cmd.alias &&
        cmd.alias.toLowerCase() === aliasLower &&
        cmd.id !== excludeId // Don't compare against the command being edited
    );
};

// Helper to get the next available ID
const getNextId = () => {
    const config = readConfig();
    const nextId = config.nextId;
    config.nextId += 1;
    writeConfig(config);
    return nextId;
};

// --- Command Implementation Functions ---

// Add Command Logic
const handleAddCommand = async (initialCommand = '', initialAlias = '', initialComment = '') => {
    const commands = readCommands();

    const response = await prompts([
        {
            type: 'text',
            name: 'command',
            message: 'Enter the full command (use {} for dynamic parts)',
            initial: initialCommand,
            validate: value => value.trim() ? true : 'Command cannot be empty.'
        },
        {
            type: 'text',
            name: 'alias',
            message: `Enter a short alias (optional, unique, no spaces/colons)`,
            initial: initialAlias,
            validate: value => {
                if (!value) return true; // Optional is fine
                if (/\s|:/.test(value)) return 'Alias cannot contain spaces or colons.';
                if (!isAliasUnique(value.trim(), commands)) {
                    return `Alias "${value.trim()}" is already in use.`;
                }
                return true;
            }
        },
        {
            type: 'text',
            name: 'comment',
            message: 'Enter a comment (optional)',
            initial: initialComment
        }
    ]);

    // Handle Ctrl+C or empty essential fields
    if (!response.command) {
        console.log(chalk.yellow('⚠️ Add command canceled.'));
        return;
    }

    const newId = getNextId();
    const alias = response.alias?.trim() || false; // Use optional chaining and ensure false if empty
    const comment = response.comment?.trim() || false;

    // Check uniqueness again just in case (though validate should catch it)
    if (alias && !isAliasUnique(alias, commands)) {
         console.error(chalk.red(`❌ Alias "${alias}" conflict detected unexpectedly. Aborting.`));
         return; // Should not happen if validation works
    }

    commands.push({ // Add to the end now, sort later or rely on ID for order
        id: newId,
        command: response.command.trim(),
        alias: alias,
        comment: comment
    });
    writeCommands(commands);
    console.log(chalk.green(`✔️ Command added successfully (ID: ${newId}${alias ? `, Alias: ${alias}` : ''}).`));
};


// List Command Logic
const handleListCommands = () => {
  const commands = readCommands();
  if (commands.length === 0) return console.log(chalk.yellow('ℹ️ No commands saved yet. Use "dumb add" to add one.'));

  const table = new Table({
      head: [chalk.bold('ID'), chalk.bold('Alias'), chalk.bold('Command'), chalk.bold('Comment')],
      colWidths: [5, 15, 50, 30], // Adjusted widths
      wordWrap: true,
      style: { head: ['cyan']}
     });

  // Sort by ID for display consistency
  const sortedCommands = commands.sort((a, b) => a.id - b.id);

  sortedCommands.forEach((cmd) => {
    table.push([
        chalk.yellow(cmd.id),
        cmd.alias ? chalk.magenta(cmd.alias) : chalk.dim('-'),
        chalk.white(cmd.command),
        cmd.comment ? chalk.grey(cmd.comment) : chalk.dim('—')
    ]);
  });

  console.log(table.toString());
};

// Delete Command Logic
const handleDeleteCommand = async (specifier) => {
    if (!specifier) return console.log(chalk.red(`❌ Please provide the ID or Alias of the command to delete.`));

    let commands = readCommands();
    const found = findCommandByIdOrAlias(specifier, commands);

    if (!found) {
        return console.log(chalk.red(`❌ Command with ID or Alias "${specifier}" not found.`));
    }

    const { command: cmdToDelete, index: internalIndex } = found;

    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Delete command #${cmdToDelete.id} (${cmdToDelete.alias || 'no alias'}): "${chalk.cyan(cmdToDelete.command)}"?`,
        initial: false
    });

    if (confirm.value) {
        commands.splice(internalIndex, 1);
        writeCommands(commands);
        console.log(chalk.green(`✔️ Command #${cmdToDelete.id} deleted successfully.`));
    } else {
        console.log(chalk.yellow('⚠️ Deletion canceled.'));
    }
};

// Edit Command Logic
const handleEditCommand = async (specifier) => {
    if (!specifier) return console.log(chalk.red(`❌ Please provide the ID or Alias of the command to edit.`));

    let commands = readCommands();
    const found = findCommandByIdOrAlias(specifier, commands);

    if (!found) {
        return console.log(chalk.red(`❌ Command with ID or Alias "${specifier}" not found.`));
    }

    const { command: cmdToEdit, index: internalIndex } = found;

    console.log(chalk.blue(`Editing command #${cmdToEdit.id} (${cmdToEdit.alias || 'no alias'}):`));
    console.log(`  Current Command: ${chalk.cyan(cmdToEdit.command)}`);
    console.log(`  Current Alias:   ${cmdToEdit.alias ? chalk.magenta(cmdToEdit.alias) : chalk.dim('-')}`);
    console.log(`  Current Comment: ${cmdToEdit.comment ? chalk.grey(cmdToEdit.comment) : chalk.dim('—')}`);

    const response = await prompts([
        {
            type: 'text',
            name: 'newCommand',
            message: 'Enter the new command (leave blank to keep current)',
            initial: cmdToEdit.command
        },
        {
            type: 'text',
            name: 'newAlias',
            message: `Enter the new alias (unique, no spaces/colons, blank to keep, " " to clear)`,
            initial: cmdToEdit.alias || '',
             validate: value => {
                 if (value === ' ') return true; // Allow clearing
                 if (!value) return true; // Allow keeping blank
                 const newAlias = value.trim();
                 if (/\s|:/.test(newAlias)) return 'Alias cannot contain spaces or colons.';
                 // Check uniqueness ONLY if the alias is actually changing to something new
                 if (newAlias.toLowerCase() !== (cmdToEdit.alias || '').toLowerCase()) {
                     if (!isAliasUnique(newAlias, commands, cmdToEdit.id)) {
                         return `Alias "${newAlias}" is already in use.`;
                     }
                 }
                 return true;
             }
        },
        {
            type: 'text',
            name: 'newComment',
            message: 'Enter the new comment (leave blank to keep current, type " " to clear)',
            initial: cmdToEdit.comment || ''
        }
    ]);

    if (typeof response.newCommand === 'undefined') { // Check if prompts was cancelled (Ctrl+C)
        return console.log(chalk.yellow('⚠️ Edit canceled.'));
    }

    let changed = false;
    const updatedCommand = response.newCommand.trim();
    const updatedAliasInput = response.newAlias; // Don't trim space meant for clearing
    const updatedCommentInput = response.newComment; // Don't trim space meant for clearing

    // Update Command
    if (updatedCommand && updatedCommand !== cmdToEdit.command) {
        commands[internalIndex].command = updatedCommand;
        changed = true;
    }

    // Update Alias
    let finalAlias = cmdToEdit.alias; // Start with current
    if (updatedAliasInput === ' ') { // Clear alias
        if (cmdToEdit.alias !== false) { // Only mark change if it wasn't already false
             finalAlias = false;
             changed = true;
        }
    } else if (updatedAliasInput.trim() && updatedAliasInput.trim() !== (cmdToEdit.alias || '')) { // Set new alias
        finalAlias = updatedAliasInput.trim();
        changed = true;
    } // If blank, keep current - no change needed explicitly
    commands[internalIndex].alias = finalAlias;


    // Update Comment
    if (updatedCommentInput === ' ') { // Clear comment
        if (cmdToEdit.comment !== false) {
             commands[internalIndex].comment = false;
             changed = true;
        }
    } else if (updatedCommentInput.trim() && updatedCommentInput.trim() !== (cmdToEdit.comment || '')) { // Set new comment
        commands[internalIndex].comment = updatedCommentInput.trim();
        changed = true;
    } // If blank, keep current

    if (changed) {
        // Final uniqueness check before writing (paranoid, but safe)
        if (commands[internalIndex].alias && !isAliasUnique(commands[internalIndex].alias, commands, cmdToEdit.id)) {
            console.error(chalk.red(`❌ Alias "${commands[internalIndex].alias}" conflict detected unexpectedly. Aborting.`));
            return;
        }
        writeCommands(commands);
        console.log(chalk.green(`✔️ Command #${cmdToEdit.id} updated successfully.`));
    } else {
        console.log(chalk.yellow('ℹ️ No changes detected.'));
    }
};

// Find Command Logic
const handleFindCommand = (query) => {
  if (!query) return console.log(chalk.red(`❌ Please provide a search query.`));

  const commands = readCommands();
  const queryLower = query.toLowerCase();

  const results = commands.filter(cmd =>
      cmd.command.toLowerCase().includes(queryLower) ||
      (cmd.alias && cmd.alias.toLowerCase().includes(queryLower)) || // Search alias too
      (cmd.comment && cmd.comment.toLowerCase().includes(queryLower))
  ).sort((a, b) => a.id - b.id); // Sort results by ID

  if (results.length === 0) return console.log(chalk.yellow(`ℹ️ No commands found matching "${query}".`));

  console.log(chalk.blue(`🔍 Found ${results.length} command(s) matching "${query}":`));

  results.forEach(cmd => {
    console.log(`\n[${chalk.yellow(cmd.id)}] ${cmd.alias ? chalk.magenta(`(${cmd.alias})`) : ''} 📌 ${chalk.white(cmd.command)}`);
    if (cmd.comment) console.log(`      💬 ${chalk.grey(cmd.comment)}`);
  });
};

// Run Command Logic (with Dynamic Placeholders)
const handleRunCommand = async (specifier, runtimeArgs) => {
    if (!specifier) return console.log(chalk.red(`❌ Please provide the ID or Alias of the command to run.`));

    const commands = readCommands();
    const found = findCommandByIdOrAlias(specifier, commands);

    if (!found) {
        return console.log(chalk.red(`❌ Command with ID or Alias "${specifier}" not found.`));
    }

    const { command: cmdToRun } = found;
    let commandString = cmdToRun.command;

    // --- Dynamic Placeholder Handling ---
    const placeholder = '{}';
    const placeholderCount = (commandString.match(/{}/g) || []).length;

    if (placeholderCount > 0) {
        if (runtimeArgs.length < placeholderCount) {
            return console.log(chalk.red(`❌ Error: Command requires ${placeholderCount} dynamic argument(s), but only ${runtimeArgs.length} provided.`));
            console.log(chalk.yellow(`   Command: ${commandString}`));
            console.log(chalk.yellow(`   Usage:   dumb run ${specifier} <arg1> <arg2> ...`));
            return;
        }

        // Sequentially replace placeholders
        let currentArgIndex = 0;
        while (commandString.includes(placeholder) && currentArgIndex < runtimeArgs.length) {
            commandString = commandString.replace(placeholder, runtimeArgs[currentArgIndex]);
            currentArgIndex++;
        }

        // Optional: Warn if extra arguments were provided but not used
        if (runtimeArgs.length > placeholderCount) {
             console.log(chalk.yellow(`⚠️ Warning: ${runtimeArgs.length} arguments provided, but only ${placeholderCount} placeholders ({}) found in the command.`));
        }
    } else if (runtimeArgs.length > 0) {
        // Command has no placeholders, but arguments were given
         console.log(chalk.yellow(`⚠️ Warning: Arguments provided (${runtimeArgs.join(' ')}) but the command has no dynamic placeholders ({}). Arguments will be ignored.`));
    }
     // --- End Dynamic Placeholder Handling ---


    // Expand tilde ~ (more robustly)
    const finalCommand = commandString.replace(/^~(?=$|\/|\\)/, os.homedir());

    const confirm = await prompts({
        type: 'confirm',
        name: 'value',
        message: `Run command #${cmdToRun.id} [${chalk.cyan(finalCommand)}]?`,
        initial: true
    });

    if (!confirm.value) return console.log(chalk.yellow('⚠️ Execution canceled.'));

    try {
        console.log(chalk.green(`🚀 Running [${cmdToRun.id}${cmdToRun.alias ? '/' + cmdToRun.alias : ''}]: ${finalCommand}`));
        // Execute the command
        execSync(finalCommand, { stdio: 'inherit', encoding: 'utf-8', shell: process.env.SHELL || true });
        console.log(chalk.green(`✅ Command [${cmdToRun.id}] finished.`));
    } catch (error) {
        console.log(chalk.red(`❌ Command [${cmdToRun.id}] failed.`));
        if (typeof error.status === 'number') {
            console.log(chalk.red(`   Exit code: ${error.status}`));
        }
    }
};


// Export Command Logic
const handleExportCommand = (exportPath) => {
    const commands = readCommands();
    if (commands.length === 0) {
        return console.log(chalk.yellow('ℹ️ No commands to export.'));
    }

    let targetPath = path.resolve(exportPath || '.'); // Default to current dir if no path given
    let targetFile;

    try {
        // Check if path exists and is a directory
        if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isDirectory()) {
             console.error(chalk.red(`❌ Error: Export path "${targetPath}" is not a valid directory or does not exist.`));
             return;
         }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `dumbcli_export_${timestamp}.json`;
        targetFile = path.join(targetPath, filename);

        // Write the *raw* command data as currently stored
        fs.writeFileSync(targetFile, JSON.stringify(commands, null, 2), 'utf-8');
        console.log(chalk.green(`✔️ Successfully exported ${commands.length} commands to:`));
        console.log(chalk.white(targetFile));

    } catch (err) {
        console.error(chalk.red(`❌ Error exporting commands to ${targetFile || targetPath}:`), err);
    }
};

// Import Command Logic
const handleImportCommand = async (importFilePath, appendMode) => {
    const targetPath = path.resolve(importFilePath);

    if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isFile()) {
        return console.error(chalk.red(`❌ Error: Import file "${targetPath}" not found or is not a file.`));
    }

    let importedCommands;
    try {
        const fileContent = fs.readFileSync(targetPath, 'utf-8');
        importedCommands = JSON.parse(fileContent);
        if (!Array.isArray(importedCommands)) {
            throw new Error('Imported file does not contain a JSON array.');
        }
        // Basic validation of imported structure (can be enhanced)
        importedCommands = importedCommands.filter(cmd => cmd && typeof cmd.command === 'string');
        if (importedCommands.length === 0) {
             return console.log(chalk.yellow('ℹ️ No valid commands found in the import file.'));
        }
    } catch (err) {
        return console.error(chalk.red(`❌ Error reading or parsing import file "${targetPath}":`), err);
    }

    console.log(chalk.blue(`Found ${importedCommands.length} potential commands in "${path.basename(targetPath)}".`));

    const currentCommands = readCommands();
    let commandsToWrite = [];
    let nextId = readConfig().nextId; // Get starting point for new IDs
    let maxCurrentId = 0;
     currentCommands.forEach(cmd => {
        if(cmd.id >= maxCurrentId) maxCurrentId = cmd.id;
     });
     // Make sure nextId is greater than any existing ID
     if(nextId <= maxCurrentId) nextId = maxCurrentId + 1;


    if (appendMode) {
        console.log(chalk.yellow('Appending imported commands...'));
        commandsToWrite = [...currentCommands]; // Start with existing commands
        const existingAliasesLower = currentCommands.map(cmd => cmd.alias?.toLowerCase()).filter(Boolean);

        importedCommands.forEach(impCmd => {
            const newCmd = {
                id: nextId++,
                command: impCmd.command.trim(),
                alias: false, // Start with no alias, assign below if valid
                comment: impCmd.comment?.trim() || false
            };

            if (impCmd.alias) {
                const proposedAlias = impCmd.alias.trim();
                const proposedAliasLower = proposedAlias.toLowerCase();
                // Check for conflicts with existing AND newly added aliases in this batch
                const currentAliasesLower = commandsToWrite.map(cmd => cmd.alias?.toLowerCase()).filter(Boolean);

                if (!/\s|:/.test(proposedAlias) && !currentAliasesLower.includes(proposedAliasLower)) {
                    newCmd.alias = proposedAlias;
                } else {
                     console.log(chalk.yellow(`  ⚠️ Alias "${proposedAlias}" from import conflicts or is invalid. Skipping alias for command: "${newCmd.command.substring(0, 30)}..."`));
                }
            }
            commandsToWrite.push(newCmd);
        });

        // Update the nextId in config AFTER processing all imports
        writeConfig({ nextId });
        writeCommands(commandsToWrite);
        console.log(chalk.green(`✔️ Successfully appended ${importedCommands.length} commands.`));
        console.log(chalk.green(`   Total commands now: ${commandsToWrite.length}.`));

    } else {
        // Overwrite Mode
        const confirm = await prompts({
            type: 'confirm',
            name: 'value',
            message: chalk.red(`⚠️ WARNING: This will ERASE ALL ${currentCommands.length} existing commands and replace them with the imported ones. Are you sure?`),
            initial: false
        });

        if (!confirm.value) return console.log(chalk.yellow('⚠️ Import (overwrite) canceled.'));

        console.log(chalk.yellow('Replacing existing commands...'));
        const importedAliasesLower = new Set(); // Track aliases within the import file itself

        importedCommands.forEach(impCmd => {
             const newCmd = {
                id: nextId++, // Assign fresh IDs sequentially
                command: impCmd.command.trim(),
                alias: false,
                comment: impCmd.comment?.trim() || false
            };

            if (impCmd.alias) {
                const proposedAlias = impCmd.alias.trim();
                 const proposedAliasLower = proposedAlias.toLowerCase();
                 if (!/\s|:/.test(proposedAlias) && !importedAliasesLower.has(proposedAliasLower)) {
                    newCmd.alias = proposedAlias;
                    importedAliasesLower.add(proposedAliasLower); // Track it
                 } else {
                    console.log(chalk.yellow(`  ⚠️ Alias "${proposedAlias}" from import is invalid or duplicated within the import file. Skipping alias for command: "${newCmd.command.substring(0, 30)}..."`));
                }
            }
            commandsToWrite.push(newCmd);
        });

         // Update the nextId in config
         writeConfig({ nextId });
         writeCommands(commandsToWrite);
         console.log(chalk.green(`✔️ Successfully imported ${commandsToWrite.length} commands (replacing previous ones).`));
    }
};


// --- Yargs Command Definitions ---

// Add
dumb.command('add', 'Add a new command interactively', {}, () => handleAddCommand());

// List
dumb.command(['ls', 'list'], 'List all saved commands', {}, () => handleListCommands());

// Delete
dumb.command('dl <specifier>', 'Delete a command by ID or Alias', (yargs) => {
  yargs.positional('specifier', { describe: 'ID or Alias of the command to delete', type: 'string' });
}, (argv) => handleDeleteCommand(argv.specifier));

// Edit
dumb.command('edit <specifier>', 'Edit a command by ID or Alias', (yargs) => {
    yargs.positional('specifier', { describe: 'ID or Alias of the command to edit', type: 'string' });
}, (argv) => handleEditCommand(argv.specifier));

// Find
dumb.command('find <query>', 'Find commands by ID, Alias, Command, or Comment (case-insensitive)', (yargs) => {
  yargs.positional('query', { describe: 'Text to search for', type: 'string' });
}, (argv) => handleFindCommand(argv.query));

// Run
dumb.command(['run <specifier> [args..]', 'r <specifier> [args..]'], 'Execute a command by ID or Alias (pass arguments for dynamic commands)', (yargs) => {
  yargs.positional('specifier', { describe: 'ID or Alias of the command to run', type: 'string' });
  yargs.positional('args', { describe: 'Arguments to pass to the command (for {} placeholders)', type: 'string', array: true }); // Capture remaining args
}, (argv) => handleRunCommand(argv.specifier, argv.args));

// Dump
dumb.command('dump', 'Show raw data from dumbcli.json', () => {
  console.log(chalk.magenta(`📂 Raw data from ${commandsFile}:`));
  try {
      const rawData = fs.existsSync(commandsFile) ? fs.readFileSync(commandsFile, 'utf-8') : '[]';
      console.log(rawData);
  } catch (err) {
      console.error(chalk.red(`❌ Error reading raw data from ${commandsFile}:`), err);
  }
});

// Export
dumb.command('export [path]', 'Export all commands to a JSON file', (yargs) => {
    yargs.positional('path', { describe: 'Optional directory path to export the file to (defaults to current)', type: 'string' });
}, (argv) => handleExportCommand(argv.path));

// Import
dumb.command('import <file>', 'Import commands from a JSON file', (yargs) => {
    yargs.positional('file', { describe: 'Path to the JSON file to import', type: 'string', demandOption: true });
    yargs.option('a', {
        alias: 'append',
        describe: 'Append imported commands instead of replacing existing ones',
        type: 'boolean',
        default: false
    });
}, (argv) => handleImportCommand(argv.file, argv.append));


// --- Power User Syntax (Experimental) ---
// Use a default command to catch non-standard input like d:a:...
dumb.command('$0 <input..>', false, (yargs) => { // '$0' makes it the default, `false` hides from help
    dumb.positional('input', { type: 'string', array: true });
}, (argv) => {
    const rawInput = argv.input.join(' '); // Reconstruct input string if spaces were involved
    const powerMatch = rawInput.match(/^d:a:(.+)$/); // Match d:a:<rest>

    if (powerMatch) {
        const parts = powerMatch[1].split(':'); // Split the <rest> by colons
        const command = parts[0]?.trim();
        const alias = parts[1]?.trim() || ''; // Optional alias
        const comment = parts.slice(2).join(':').trim() || ''; // Rest is comment

        if (command) {
            console.log(chalk.cyan('⚡ Power Add detected...'));
            // Directly call handler, bypassing prompts - needs slight modification
            // Or, more simply, call the prompt-based handler with initial values:
            handleAddCommand(command, alias, comment);
            return; // Stop further processing
        }
    }

    // If it didn't match the power syntax or wasn't handled, show the welcome/help message.
    showWelcomeOrHelp();
});

const printBanner = () => {
    const logo = `
██████╗ ██╗   ██╗███╗   ███╗███████╗╔██████╗██╗     ██╗
██╔══██╗██║   ██║████╗ ████║██╔══██║║██╔═══╝██║     ██║
██║  ██║██║   ██║██╔████╔██║███████║║██║    ██║     ██║
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║║██║    ██║     ██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║███████║╚██████╗███████╗██║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝╚══════╝╚═╝
    `;
    // Print the logo in Red (classic hacking style) or Cyan (modern)
    console.log(chalk.cyan.bold(logo)); 
    console.log(chalk.yellow.bold('      The "Dumb" Way to Manage Smart Commands\n'));
};


// --- Yargs Setup and Finalization ---

const showWelcomeOrHelp = () => {
    // Only show detailed welcome if *exactly* 'dumb' is typed with no arguments/commands
    if (process.argv.length === 2 && process.stdin.isTTY) {
        printBanner();
        console.log(chalk.green.bold('👋 Welcome to DumbCLI! (v1.3.0 - Now with IDs, Aliases & more!)'));
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
        console.log('\n' + chalk.cyan('Power User Quick Add:'));
        console.log('  - d:a:<command>[:alias[:comment]]');
        console.log('\n' + chalk.dim(`Use "dumb --help" for all commands and options.`));
        console.log(chalk.dim(`Config directory: ${configDir}`));
        console.log(`\nConnect with me on GitHub: ${chalk.blueBright('https://github.com/S488U')}`);
        process.exit(0);
    } else {
         // If arguments were given but not parsed by a specific command (or the $0 default didn't handle it)
         // Yargs' demandCommand and strict mode should handle showing errors/help appropriately.
         // We don't need an explicit else here unless we want custom fallback behavior.
    }
};


yargs.version('1.3.0') // Updated version
    .alias('v', 'version')
    .help()
    .alias('h', 'help')
    .wrap(dumb.terminalWidth())
    .strict() // Report unrecognized commands/options
    // Use fail handler for better custom error messages if needed, but demandCommand is often enough
    //.demandCommand(1, '') // Suppress default message, rely on our welcome or $0 handler
    .recommendCommands() // Suggest commands on typo
    .epilog(`For more help, visit: ${chalk.blueBright('https://github.com/S488U')}`)
    // Update examples
    .example('dumb add', 'Add a new command interactively.')
    .example('dumb ls', 'List all stored commands.')
    .example('dumb find "docker"', 'Search commands/comments/aliases for "docker".')
    .example('dumb run 5', 'Execute the command with ID 5.')
    .example('dumb run deploy-app', 'Execute the command with alias "deploy-app".')
    .example('dumb run build assets/style.css public/style.css', 'Run command "build" with arguments.')
    .example('dumb edit 3', 'Edit the command with ID 3.')
    .example('dumb edit fix-db', 'Edit the command with alias "fix-db".')
    .example('dumb dl 8', 'Delete the command with ID 8.')
    .example('dumb import my_commands.json', 'Import commands, replacing existing ones.')
    .example('dumb import -a shared_commands.json', 'Append commands from a file.')
    .example('dumb export ./backups', 'Export commands to the backups folder.')
    .example('d:a:echo "Hello World":hello:Simple echo', 'Quickly add a command.');


// --- Initial Checks and Execution ---
ensureConfigDirExists(); // Make sure config dir exists early

// Only parse if we didn't handle it via the $0 check above or the specific welcome message
if (process.argv.length > 2 || (process.argv.length === 2 && !process.stdin.isTTY)) {
     dumb.parse();
} else if (process.argv.length === 2 && process.stdin.isTTY) {
    // This case should now be handled by the $0 default command triggering showWelcomeOrHelp
    // But we can leave this as a fallback safety net.
    showWelcomeOrHelp();
}

// Note: Yargs parse() usually handles exiting. If the $0 command handles input,
// it might prevent yargs from showing its default help/error for *no* input.
// The logic above tries to show the welcome message specifically when only `dumb` is run.
