import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import prompts from 'prompts';
import { getStoragePaths, readCommands, readConfig, writeCommands, writeConfig } from '../storage/store.js';
import { isValidAlias } from '../core/commands.js';

/**
 * Build normalized command objects from imported entries, resolving alias collisions.
 */
const buildImportedCommands = (importedCommands, startingId, existingAliasesLower) => {
  let nextId = startingId;
  const seenAliasesLower = new Set(existingAliasesLower);
  const added = [];

  for (const impCmd of importedCommands) {
    const newCmd = {
      id: nextId++,
      command: impCmd.command.trim(),
      alias: false,
      comment: typeof impCmd.comment === 'string' && impCmd.comment.trim() ? impCmd.comment.trim() : false,
    };

    if (typeof impCmd.alias === 'string' && impCmd.alias.trim()) {
      const proposedAlias = impCmd.alias.trim();
      const proposedAliasLower = proposedAlias.toLowerCase();
      if (isValidAlias(proposedAlias) && !seenAliasesLower.has(proposedAliasLower)) {
        newCmd.alias = proposedAlias;
        seenAliasesLower.add(proposedAliasLower);
      } else {
        console.log(
          chalk.yellow(
            `  ⚠️ Alias "${proposedAlias}" from import conflicts or is invalid. Skipping alias for command: "${newCmd.command.substring(0, 30)}..."`
          )
        );
      }
    }

    added.push(newCmd);
  }

  return { added, nextId };
};

/**
 * Import commands from a JSON file (append or overwrite).
 */
export const handleImportCommand = async (importFilePath, appendMode = false, deps = {}) => {
  const paths = deps.paths ?? getStoragePaths();
  const promptFn = deps.prompts ?? prompts;
  const targetPath = path.resolve(importFilePath);

  if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isFile()) {
    console.error(chalk.red(`❌ Error: Import file "${targetPath}" not found or is not a file.`));
    return false;
  }

  let importedCommands;
  try {
    const fileContent = fs.readFileSync(targetPath, 'utf-8');
    const parsed = JSON.parse(fileContent);
    if (!Array.isArray(parsed)) {
      throw new Error('Imported file does not contain a JSON array.');
    }
    importedCommands = parsed.filter((cmd) => cmd && typeof cmd.command === 'string' && cmd.command.trim());
    if (importedCommands.length === 0) {
      console.log(chalk.yellow('ℹ️ No valid commands found in the import file.'));
      return false;
    }
  } catch (err) {
    console.error(chalk.red(`❌ Error reading or parsing import file "${targetPath}":`), err);
    return false;
  }

  console.log(chalk.blue(`Found ${importedCommands.length} potential commands in "${path.basename(targetPath)}".`));

  const currentCommands = readCommands(paths);
  const config = readConfig(paths);
  const maxCurrentId = currentCommands.reduce((max, cmd) => (cmd.id > max ? cmd.id : max), 0);
  const startId = Math.max(config.nextId, maxCurrentId + 1);

  if (appendMode) {
    console.log(chalk.yellow('Appending imported commands...'));
    const existingAliases = currentCommands.map((cmd) => cmd.alias?.toLowerCase()).filter(Boolean);
    const { added, nextId } = buildImportedCommands(importedCommands, startId, existingAliases);
    const commandsToWrite = [...currentCommands, ...added];

    writeConfig({ ...config, nextId }, paths);
    writeCommands(commandsToWrite, paths);
    console.log(chalk.green(`✔️ Successfully appended ${added.length} commands.`));
    console.log(chalk.green(`   Total commands now: ${commandsToWrite.length}.`));
    return true;
  }

  const confirm = await promptFn({
    type: 'confirm',
    name: 'value',
    message: chalk.red(
      `⚠️ WARNING: This will ERASE ALL ${currentCommands.length} existing commands and replace them with the imported ones. Are you sure?`
    ),
    initial: false,
  });

  if (!confirm.value) {
    console.log(chalk.yellow('⚠️ Import (overwrite) canceled.'));
    return false;
  }

  console.log(chalk.yellow('Replacing existing commands...'));
  const { added, nextId } = buildImportedCommands(importedCommands, startId, []);

  writeConfig({ ...config, nextId }, paths);
  writeCommands(added, paths);
  console.log(chalk.green(`✔️ Successfully imported ${added.length} commands (replacing previous ones).`));
  return true;
};
