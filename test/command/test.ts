import anyTest, { TestInterface } from 'ava';
import fs from 'fs';
import { mkdtemp } from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  createCommandHelper,
  IGitCommandHelper,
} from '../../src/git/helpers/command';

interface GitCommandHelperTestInterface {
  baseDir: string;
  git: IGitCommandHelper;
}
const test = anyTest as TestInterface<GitCommandHelperTestInterface>;

test.before(async (t) => {
  const baseDir = path.join(os.tmpdir(), 'test-git-command-helper');
  fs.mkdirSync(baseDir, { recursive: true });
  t.context.baseDir = baseDir;
});

test.beforeEach(async (t) => {
  const workDir = await mkdtemp(path.join(t.context.baseDir, 'test-'));
  const git = await createCommandHelper(workDir);
  t.context.git = git;
});

test('GitCommandHelper: init should be create .git folder', async (t) => {
  await t.context.git.init();
  const dotGit = fs.existsSync(
    path.join(t.context.git.getWorkingDirectory(), '.git'),
  );
  t.is(dotGit, true);
});

test('GitCommandHelper: init with branch name should be create an expected name', async (t) => {
  await t.context.git.init('feat/expected');
  const branch = await t.context.git.branchCurrent();
  t.is(branch, 'feat/expected');
});
