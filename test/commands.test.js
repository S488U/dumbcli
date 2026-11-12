import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getStoragePaths, readCommands, writeCommands, writeConfig } from '../src/storage/store.js';
import { handleAddCommand } from '../src/commands/add.js';
import { handleListCommands } from '../src/commands/list.js';
import { handleDeleteCommand } from '../src/commands/delete.js';
import { handleEditCommand } from '../src/commands/edit.js';
import { handleFindCommand } from '../src/commands/find.js';
import { handleRunCommand } from '../src/commands/run.js';
import { handleExportCommand } from '../src/commands/export.js';
import { handleImportCommand } from '../src/commands/import.js';
import { handleDumpCommand } from '../src/commands/dump.js';
import { runCli } from '../src/app.js';

const tempDirs = [];

const createTempEnv = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dumbcli-cmd-test-'));
  tempDirs.push(dir);
  return { dir, paths: getStoragePaths(dir) };
};

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('commands and CLI integration', () => {
  it('adds, lists, finds, edits, and deletes commands', async () => {
    const { paths } = createTempEnv();

    const added = await handleAddCommand('', '', '', {
      paths,
      prompts: async () => ({ command: 'echo hello {}', alias: 'hi', comment: 'Greeting' }),
    });
    assert.equal(added.id, 1);
    assert.equal(added.alias, 'hi');

    assert.equal(handleListCommands({ paths }).length, 1);
    assert.equal(handleFindCommand('1', { paths }).length, 1);
    assert.equal(handleFindCommand('greeting', { paths }).length, 1);

    const edited = await handleEditCommand('hi', {
      paths,
      prompts: async () => ({ newCommand: 'echo hi {}', newAlias: 'hello', newComment: ' ' }),
    });
    assert.equal(edited, true);
    const afterEdit = readCommands(paths);
    assert.equal(afterEdit[0].command, 'echo hi {}');
    assert.equal(afterEdit[0].alias, 'hello');
    assert.equal(afterEdit[0].comment, false);

    const deleted = await handleDeleteCommand('1', {
      paths,
      prompts: async () => ({ value: true }),
    });
    assert.equal(deleted, true);
    assert.equal(readCommands(paths).length, 0);
  });

  it('runs commands with safe placeholder substitution and rejects missing args', async () => {
    const { paths } = createTempEnv();
    writeConfig({ nextId: 2 }, paths);
    writeCommands([{ id: 1, alias: 'say', command: 'echo {} {}', comment: false }], paths);

    let executedCmd = null;
    const missingOk = await handleRunCommand('say', ['only-one'], {
      paths,
      prompts: async () => ({ value: true }),
      execSync: (cmd) => {
        executedCmd = cmd;
      },
    });
    assert.equal(missingOk, false);
    assert.equal(executedCmd, null);

    const runOk = await handleRunCommand('say', ['a{}b', '$1'], {
      paths,
      prompts: async () => ({ value: true }),
      execSync: (cmd) => {
        executedCmd = cmd;
      },
    });
    assert.equal(runOk, true);
    assert.equal(executedCmd, 'echo a{}b $1');
  });

  it('exports, dumps, and imports commands in append and overwrite modes', async () => {
    const { dir, paths } = createTempEnv();
    const exportDir = path.join(dir, 'exports');
    fs.mkdirSync(exportDir);

    writeConfig({ nextId: 2 }, paths);
    writeCommands([{ id: 1, alias: 'a1', command: 'echo one', comment: 'first' }], paths);

    const exportedFile = handleExportCommand(exportDir, { paths });
    assert.ok(exportedFile && fs.existsSync(exportedFile));
    assert.ok(handleDumpCommand({ paths }).includes('echo one'));

    const importFile = path.join(dir, 'import.json');
    fs.writeFileSync(
      importFile,
      JSON.stringify([
        { command: 'echo two', alias: 'a1', comment: 'conflicting alias' },
        { command: 'echo three', alias: 'a3', comment: 'new alias' },
      ]),
      'utf-8'
    );

    const appended = await handleImportCommand(importFile, true, { paths });
    assert.equal(appended, true);
    const afterAppend = readCommands(paths);
    assert.equal(afterAppend.length, 3);
    assert.equal(afterAppend[1].alias, false); // skipped conflicting 'a1'
    assert.equal(afterAppend[2].alias, 'a3');

    const overwritten = await handleImportCommand(importFile, false, {
      paths,
      prompts: async () => ({ value: true }),
    });
    assert.equal(overwritten, true);
    const afterOverwrite = readCommands(paths);
    assert.equal(afterOverwrite.length, 2);
    assert.equal(afterOverwrite[0].alias, 'a1');
  });

  it('routes power-add syntax through runCli', async () => {
    const { paths } = createTempEnv();
    let capturedInitials = null;

    await runCli(['d:a:echo test:t:demo'], {
      paths,
      exitProcess: false,
      prompts: async (questions) => {
        capturedInitials = questions.map((q) => q.initial);
        return {
          command: questions[0].initial,
          alias: questions[1].initial,
          comment: questions[2].initial,
        };
      },
    });

    assert.deepEqual(capturedInitials, ['echo test', 't', 'demo']);
    const saved = readCommands(paths);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].command, 'echo test');
    assert.equal(saved[0].alias, 't');
  });
});
