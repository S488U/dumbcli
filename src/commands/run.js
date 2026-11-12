import chalk from 'chalk';
import prompts from 'prompts';
import { execSync } from 'child_process';
import { getStoragePaths, readCommands } from '../storage/store.js';
import { expandLeadingTilde, findCommandByIdOrAlias, replacePlaceholders } from '../core/commands.js';

/**
 * Execute a saved command by ID or alias with optional `{}` placeholder arguments.
 */
export const handleRunCommand = async (specifier, runtimeArgs = [], deps = {}) => {
  if (!specifier) {
    console.log(chalk.red('❌ Please provide the ID or Alias of the command to run.'));
    return false;
  }

  const paths = deps.paths ?? getStoragePaths();
  const promptFn = deps.prompts ?? prompts;
  const execFn = deps.execSync ?? execSync;

  const commands = readCommands(paths);
  const found = findCommandByIdOrAlias(specifier, commands);

  if (!found) {
    console.log(chalk.red(`❌ Command with ID or Alias "${specifier}" not found.`));
    return false;
  }

  const { command: cmdToRun } = found;
  const substituted = replacePlaceholders(cmdToRun.command, runtimeArgs);

  if (!substituted.ok) {
    console.log(
      chalk.red(
        `❌ Error: Command requires ${substituted.placeholderCount} dynamic argument(s), but only ${substituted.providedCount} provided.`
      )
    );
    console.log(chalk.yellow(`   Command: ${cmdToRun.command}`));
    console.log(chalk.yellow(`   Usage:   dumb run ${specifier} <arg1> <arg2> ...`));
    return false;
  }

  if (substituted.placeholderCount > 0 && substituted.extraArgs.length > 0) {
    console.log(
      chalk.yellow(
        `⚠️ Warning: ${runtimeArgs.length} arguments provided, but only ${substituted.placeholderCount} placeholders ({}) found in the command.`
      )
    );
  } else if (substituted.placeholderCount === 0 && runtimeArgs.length > 0) {
    console.log(
      chalk.yellow(
        `⚠️ Warning: Arguments provided (${runtimeArgs.join(' ')}) but the command has no dynamic placeholders ({}). Arguments will be ignored.`
      )
    );
  }

  const finalCommand = expandLeadingTilde(substituted.command);

  const confirm = await promptFn({
    type: 'confirm',
    name: 'value',
    message: `Run command #${cmdToRun.id} [${chalk.cyan(finalCommand)}]?`,
    initial: true,
  });

  if (!confirm.value) {
    console.log(chalk.yellow('⚠️ Execution canceled.'));
    return false;
  }

  try {
    console.log(
      chalk.green(`🚀 Running [${cmdToRun.id}${cmdToRun.alias ? '/' + cmdToRun.alias : ''}]: ${finalCommand}`)
    );
    execFn(finalCommand, { stdio: 'inherit', encoding: 'utf-8', shell: process.env.SHELL || true });
    console.log(chalk.green(`✅ Command [${cmdToRun.id}] finished.`));
    return true;
  } catch (error) {
    console.log(chalk.red(`❌ Command [${cmdToRun.id}] failed.`));
    if (typeof error.status === 'number') {
      console.log(chalk.red(`   Exit code: ${error.status}`));
    }
    return false;
  }
};
