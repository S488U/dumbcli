import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { getStoragePaths, readCommands } from '../storage/store.js';

/**
 * Export saved commands to a timestamped JSON file in the target directory.
 */
export const handleExportCommand = (exportPath, deps = {}) => {
  const paths = deps.paths ?? getStoragePaths();
  const commands = readCommands(paths);
  if (commands.length === 0) {
    console.log(chalk.yellow('ℹ️ No commands to export.'));
    return null;
  }

  const targetPath = path.resolve(exportPath || '.');
  let targetFile;

  try {
    if (!fs.existsSync(targetPath) || !fs.lstatSync(targetPath).isDirectory()) {
      console.error(chalk.red(`❌ Error: Export path "${targetPath}" is not a valid directory or does not exist.`));
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `dumbcli_export_${timestamp}.json`;
    targetFile = path.join(targetPath, filename);

    fs.writeFileSync(targetFile, JSON.stringify(commands, null, 2), 'utf-8');
    console.log(chalk.green(`✔️ Successfully exported ${commands.length} commands to:`));
    console.log(chalk.white(targetFile));
    return targetFile;
  } catch (err) {
    console.error(chalk.red(`❌ Error exporting commands to ${targetFile || targetPath}:`), err);
    return null;
  }
};
