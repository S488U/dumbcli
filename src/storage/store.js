import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

/**
 * Resolve storage paths for DumbCLI config and command data.
 * Uses DUMBCLI_HOME when set (useful for custom locations and isolated tests).
 */
export const getStoragePaths = (baseDir = process.env.DUMBCLI_HOME || path.join(os.homedir(), '.dumbcli')) => ({
  configDir: baseDir,
  commandsFile: path.join(baseDir, 'dumbcli.json'),
  configFilePath: path.join(baseDir, 'config.json'),
});

/**
 * Ensure the configuration directory exists.
 */
export const ensureConfigDirExists = (paths = getStoragePaths()) => {
  if (!fs.existsSync(paths.configDir)) {
    try {
      fs.mkdirSync(paths.configDir, { recursive: true });
    } catch (err) {
      console.error(chalk.red(`❌ Fatal Error: Could not create configuration directory at ${paths.configDir}.`), err);
      process.exit(1);
    }
  }
};

/**
 * Read configuration (currently stores nextId).
 */
export const readConfig = (paths = getStoragePaths()) => {
  ensureConfigDirExists(paths);
  if (!fs.existsSync(paths.configFilePath)) {
    return { nextId: 1 };
  }
  try {
    const data = fs.readFileSync(paths.configFilePath, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      nextId: Number.isInteger(parsed?.nextId) && parsed.nextId > 0 ? parsed.nextId : 1,
    };
  } catch (err) {
    console.error(chalk.red(`❌ Error reading config file ${paths.configFilePath}. Using defaults.`), err);
    return { nextId: 1 };
  }
};

/**
 * Persist configuration to disk.
 */
export const writeConfig = (config, paths = getStoragePaths()) => {
  ensureConfigDirExists(paths);
  try {
    fs.writeFileSync(paths.configFilePath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error(chalk.red(`❌ Error writing config file ${paths.configFilePath}.`), err);
  }
};

/**
 * Normalize loaded command entries and assign collision-free IDs to legacy entries.
 */
export const normalizeCommands = (commands) => {
  const usedIds = new Set();
  for (const cmd of commands) {
    if (cmd && Number.isInteger(cmd.id) && cmd.id > 0) {
      usedIds.add(cmd.id);
    }
  }

  let fallbackId = 1;
  const allocateFallbackId = () => {
    while (usedIds.has(fallbackId)) {
      fallbackId += 1;
    }
    usedIds.add(fallbackId);
    return fallbackId;
  };

  return commands.map((cmd) => ({
    id: cmd && Number.isInteger(cmd.id) && cmd.id > 0 ? cmd.id : allocateFallbackId(),
    alias: cmd?.alias || false,
    command: cmd?.command || 'INVALID_COMMAND',
    comment: cmd?.comment || false,
  }));
};

/**
 * Read all saved commands from disk.
 */
export const readCommands = (paths = getStoragePaths()) => {
  ensureConfigDirExists(paths);
  if (!fs.existsSync(paths.commandsFile)) {
    return [];
  }
  try {
    const fileContent = fs.readFileSync(paths.commandsFile, 'utf-8');
    if (fileContent.trim() === '') {
      return [];
    }
    const commands = JSON.parse(fileContent);
    if (!Array.isArray(commands)) {
      console.error(chalk.red(`❌ Error: ${paths.commandsFile} does not contain a valid JSON array.`));
      console.error(chalk.yellow('   Returning empty command list. Consider backing up and fixing the file.'));
      return [];
    }
    return normalizeCommands(commands);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(chalk.red(`❌ Error: Could not parse ${paths.commandsFile}. It might be corrupted JSON.`));
    } else {
      console.error(chalk.red(`❌ Error reading commands file at ${paths.commandsFile}:`), err);
    }
    console.error(chalk.yellow('   Returning empty command list due to error.'));
    return [];
  }
};

/**
 * Sort and write all commands to disk.
 */
export const writeCommands = (commands, paths = getStoragePaths()) => {
  ensureConfigDirExists(paths);
  try {
    const sortedCommands = [...commands].sort((a, b) => a.id - b.id);
    fs.writeFileSync(paths.commandsFile, JSON.stringify(sortedCommands, null, 2), 'utf-8');
  } catch (err) {
    console.error(chalk.red(`❌ Error writing commands file at ${paths.commandsFile}:`), err);
  }
};

/**
 * Compute and persist the next unique command ID, avoiding collisions with existing/migrated IDs.
 */
export const getNextId = (paths = getStoragePaths(), existingCommands = null) => {
  const config = readConfig(paths);
  const commands = existingCommands ?? readCommands(paths);
  const maxExistingId = commands.reduce((max, cmd) => (cmd.id > max ? cmd.id : max), 0);
  const nextId = Math.max(config.nextId, maxExistingId + 1);
  writeConfig({ ...config, nextId: nextId + 1 }, paths);
  return nextId;
};
