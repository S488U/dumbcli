import os from 'os';

const PLACEHOLDER_REGEX = /\{\}/g;
const NUMERIC_ID_REGEX = /^\d+$/;

/**
 * Validate an alias string (must be non-empty without whitespace or colons).
 */
export const isValidAlias = (alias) => {
  if (typeof alias !== 'string') return false;
  const trimmed = alias.trim();
  return trimmed.length > 0 && !/\s|:/.test(trimmed);
};

/**
 * Check whether an alias is unique among commands (case-insensitive).
 */
export const isAliasUnique = (alias, commands, excludeId = null) => {
  if (!alias) return true;
  const aliasLower = alias.toLowerCase();
  return !commands.some(
    (cmd) =>
      cmd.alias &&
      cmd.alias.toLowerCase() === aliasLower &&
      cmd.id !== excludeId
  );
};

/**
 * Find a command by exact numeric ID or case-insensitive alias.
 */
export const findCommandByIdOrAlias = (specifier, commands) => {
  const raw = String(specifier).trim();
  if (!raw) return null;

  if (NUMERIC_ID_REGEX.test(raw)) {
    const idSearch = Number(raw);
    const idIndex = commands.findIndex((cmd) => cmd.id === idSearch);
    if (idIndex !== -1) {
      return { command: commands[idIndex], index: idIndex };
    }
  }

  const searchLower = raw.toLowerCase();
  const aliasIndex = commands.findIndex(
    (cmd) => cmd.alias && cmd.alias.toLowerCase() === searchLower
  );
  if (aliasIndex !== -1) {
    return { command: commands[aliasIndex], index: aliasIndex };
  }

  return null;
};

/**
 * Replace `{}` placeholders in a single pass so runtime args containing `{}` or `$` are never re-expanded.
 */
export const replacePlaceholders = (commandString, runtimeArgs = []) => {
  const matches = commandString.match(PLACEHOLDER_REGEX);
  const placeholderCount = matches ? matches.length : 0;

  if (placeholderCount === 0) {
    return {
      ok: true,
      command: commandString,
      placeholderCount: 0,
      extraArgs: runtimeArgs,
    };
  }

  if (runtimeArgs.length < placeholderCount) {
    return {
      ok: false,
      command: commandString,
      placeholderCount,
      providedCount: runtimeArgs.length,
      extraArgs: [],
    };
  }

  let currentArgIndex = 0;
  const command = commandString.replace(PLACEHOLDER_REGEX, () => runtimeArgs[currentArgIndex++]);

  return {
    ok: true,
    command,
    placeholderCount,
    extraArgs: runtimeArgs.slice(placeholderCount),
  };
};

/**
 * Expand a leading `~` to the user's home directory.
 */
export const expandLeadingTilde = (commandString, homeDir = os.homedir()) =>
  commandString.replace(/^~(?=$|\/|\\)/, homeDir);

/**
 * Filter commands by ID, alias, command text, or comment (case-insensitive), sorted by ID.
 */
export const filterCommands = (commands, query) => {
  const queryLower = String(query).toLowerCase();
  return commands
    .filter(
      (cmd) =>
        String(cmd.id).includes(queryLower) ||
        cmd.command.toLowerCase().includes(queryLower) ||
        (cmd.alias && cmd.alias.toLowerCase().includes(queryLower)) ||
        (cmd.comment && cmd.comment.toLowerCase().includes(queryLower))
    )
    .sort((a, b) => a.id - b.id);
};

/**
 * Parse power-user quick-add syntax: `d:a:<command>[:alias[:comment]]`.
 */
export const parsePowerAddInput = (rawInput) => {
  const powerMatch = String(rawInput).match(/^d:a:(.+)$/);
  if (!powerMatch) return null;

  const parts = powerMatch[1].split(':');
  const command = parts[0]?.trim() || '';
  if (!command) return null;

  return {
    command,
    alias: parts[1]?.trim() || '',
    comment: parts.slice(2).join(':').trim() || '',
  };
};
