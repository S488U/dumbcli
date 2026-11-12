import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandLeadingTilde,
  filterCommands,
  findCommandByIdOrAlias,
  isAliasUnique,
  isReservedAlias,
  isValidAlias,
  parsePowerAddInput,
  replacePlaceholders,
  validateAlias,
} from '../src/core/commands.js';

describe('core/commands', () => {
  const sampleCommands = [
    { id: 1, alias: 'build', command: 'npm run build', comment: 'Build app' },
    { id: 2, alias: '1abc', command: 'echo digit-alias', comment: false },
    { id: 10, alias: 'deploy', command: 'scp {} user@host:{}', comment: 'Deploy to server' },
  ];

  it('validates aliases properly', () => {
    assert.equal(isValidAlias('build'), true);
    assert.equal(isValidAlias('my-alias_1'), true);
    assert.equal(isValidAlias(''), false);
    assert.equal(isValidAlias('   '), false);
    assert.equal(isValidAlias('has space'), false);
    assert.equal(isValidAlias('has:colon'), false);
    assert.equal(isValidAlias(null), false);
  });

  it('checks alias uniqueness case-insensitively with excludeId support', () => {
    assert.equal(isAliasUnique('BUILD', sampleCommands), false);
    assert.equal(isAliasUnique('BUILD', sampleCommands, 1), true);
    assert.equal(isAliasUnique('fresh', sampleCommands), true);
    assert.equal(isAliasUnique('', sampleCommands), true);
  });

  it('rejects reserved built-in command names in validateAlias', () => {
    assert.equal(isReservedAlias('ls'), true);
    assert.equal(isReservedAlias('RUN'), true);
    assert.equal(isReservedAlias('c'), false);
    assert.match(validateAlias('ls', sampleCommands), /reserved/i);
    assert.match(validateAlias('build', sampleCommands), /already in use/i);
    assert.equal(validateAlias('c', sampleCommands), true);
  });

  it('finds commands by strict numeric ID or case-insensitive alias without parseInt prefix bugs', () => {
    assert.equal(findCommandByIdOrAlias('1', sampleCommands)?.command.id, 1);
    assert.equal(findCommandByIdOrAlias('BUILD', sampleCommands)?.command.id, 1);
    // "1abc" must match alias "1abc" (ID 2), NOT ID 1 via parseInt("1abc", 10)
    assert.equal(findCommandByIdOrAlias('1abc', sampleCommands)?.command.id, 2);
    assert.equal(findCommandByIdOrAlias('missing', sampleCommands), null);
    assert.equal(findCommandByIdOrAlias('   ', sampleCommands), null);
  });

  it('replaces placeholders in a single pass without re-expanding {} or interpreting $ patterns', () => {
    const res = replacePlaceholders('echo {} && echo {}', ['a{}b', '$& $1 $$']);
    assert.equal(res.ok, true);
    assert.equal(res.placeholderCount, 2);
    assert.equal(res.command, 'echo a{}b && echo $& $1 $$');
    assert.deepEqual(res.extraArgs, []);

    const missing = replacePlaceholders('cp {} {}', ['only-one']);
    assert.equal(missing.ok, false);
    assert.equal(missing.placeholderCount, 2);
    assert.equal(missing.providedCount, 1);

    const extra = replacePlaceholders('echo {}', ['one', 'two']);
    assert.equal(extra.ok, true);
    assert.deepEqual(extra.extraArgs, ['two']);
  });

  it('expands leading tilde only at start of command', () => {
    assert.equal(expandLeadingTilde('~/scripts/run.sh', '/home/user'), '/home/user/scripts/run.sh');
    assert.equal(expandLeadingTilde('~', '/home/user'), '/home/user');
    assert.equal(expandLeadingTilde('ls ~/docs', '/home/user'), 'ls ~/docs');
    assert.equal(expandLeadingTilde('~other/file', '/home/user'), '~other/file');
  });

  it('filters commands by ID, alias, command, and comment', () => {
    assert.deepEqual(
      filterCommands(sampleCommands, '10').map((c) => c.id),
      [10]
    );
    assert.deepEqual(
      filterCommands(sampleCommands, 'DEPLOY').map((c) => c.id),
      [10]
    );
    assert.deepEqual(
      filterCommands(sampleCommands, 'digit-alias').map((c) => c.id),
      [2]
    );
    assert.deepEqual(
      filterCommands(sampleCommands, 'build app').map((c) => c.id),
      [1]
    );
  });

  it('parses power-user quick-add syntax', () => {
    assert.deepEqual(parsePowerAddInput('d:a:echo hi:greet:Simple greeting'), {
      command: 'echo hi',
      alias: 'greet',
      comment: 'Simple greeting',
    });
    assert.deepEqual(parsePowerAddInput('d:a:ls -la'), {
      command: 'ls -la',
      alias: '',
      comment: '',
    });
    assert.equal(parsePowerAddInput('d:a:'), null);
    assert.equal(parsePowerAddInput('unknown command'), null);
  });
});
