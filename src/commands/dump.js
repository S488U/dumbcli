import fs from 'fs';
import chalk from 'chalk';
import { getStoragePaths } from '../storage/store.js';

/**
 * Print the raw contents of dumbcli.json.
 */
export const handleDumpCommand = (deps = {}) => {
  const paths = deps.paths ?? getStoragePaths();
  console.log(chalk.magenta(`📂 Raw data from ${paths.commandsFile}:`));
  try {
    const rawData = fs.existsSync(paths.commandsFile) ? fs.readFileSync(paths.commandsFile, 'utf-8') : '[]';
    console.log(rawData);
    return rawData;
  } catch (err) {
    console.error(chalk.red(`❌ Error reading raw data from ${paths.commandsFile}:`), err);
    return null;
  }
};
