import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  getNextId,
  getStoragePaths,
  normalizeCommands,
  readCommands,
  readConfig,
  writeCommands,
  writeConfig,
} from '../src/storage/store.js';

const tempDirs = [];

const createTempPaths = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dumbcli-test-'));
  tempDirs.push(dir);
  return getStoragePaths(dir);
};

afterEach(() => {
  while (tempDirs.length > 0) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe('storage/store', () => {
  it('reads defaults when config or commands files do not exist', () => {
    const paths = createTempPaths();
    assert.deepEqual(readConfig(paths), { nextId: 1 });
    assert.deepEqual(readCommands(paths), []);
  });

  it('writes and reads sorted commands and config', () => {
    const paths = createTempPaths();
    writeConfig({ nextId: 5 }, paths);
    assert.deepEqual(readConfig(paths), { nextId: 5 });

    writeCommands(
      [
        { id: 3, command: 'echo 3', alias: 'three', comment: false },
        { id: 1, command: 'echo 1', alias: false, comment: 'first' },
      ],
      paths
    );

    const loaded = readCommands(paths);
    assert.deepEqual(
      loaded.map((c) => c.id),
      [1, 3]
    );
  });

  it('normalizes legacy commands without IDs and avoids ID collisions in getNextId', () => {
    const paths = createTempPaths();
    fs.writeFileSync(
      paths.commandsFile,
      JSON.stringify([
        { command: 'echo legacy-1', comment: 'no id' },
        { id: 2, command: 'echo existing-2' },
        { command: 'echo legacy-2' },
      ]),
      'utf-8'
    );

    const loaded = readCommands(paths);
    assert.deepEqual(
      loaded.map((c) => c.id),
      [1, 2, 3]
    );

    const nextId = getNextId(paths);
    assert.equal(nextId, 4);
    assert.equal(readConfig(paths).nextId, 5);
  });

  it('handles normalizeCommands with mixed missing and explicit IDs', () => {
    const normalized = normalizeCommands([
      { id: 1, command: 'a' },
      { command: 'b' },
      { id: 3, command: 'c' },
    ]);
    assert.deepEqual(
      normalized.map((c) => c.id),
      [1, 2, 3]
    );
  });
});
