#!/usr/bin/env node

import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

function runCapture(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();
}

const root = process.cwd();
const branch = process.env.PAGES_BRANCH || 'gh-pages';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Deploy static site to GitHub Pages branch.');
  console.log('');
  console.log('Usage: npm run deploy:pages');
  console.log('');
  console.log('Environment variables:');
  console.log('  PAGES_BRANCH   Target branch (default: gh-pages)');
  process.exit(0);
}

if (!existsSync(join(root, 'index.html'))) {
  throw new Error('index.html not found in project root. Run this from the app root.');
}

let remoteUrl = '';
try {
  remoteUrl = runCapture('git', ['config', '--get', 'remote.origin.url'], root);
} catch {
  remoteUrl = '';
}
if (!remoteUrl) {
  throw new Error('No git remote origin found. Add a remote first (git remote add origin <url>).');
}

const tempDir = mkdtempSync(join(tmpdir(), 'section1-pages-'));
const siteDir = join(tempDir, 'site');

function branchExistsRemote(remote, branchName) {
  try {
    const out = runCapture('git', ['ls-remote', '--heads', remote, branchName], root);
    return Boolean(out);
  } catch {
    return false;
  }
}

try {
  const hasRemoteBranch = branchExistsRemote(remoteUrl, branch);

  if (hasRemoteBranch) {
    run('git', ['clone', '--depth', '1', '--branch', branch, remoteUrl, siteDir], root);
  } else {
    run('git', ['init', siteDir], root);
    run('git', ['checkout', '--orphan', branch], siteDir);
    run('git', ['remote', 'add', 'origin', remoteUrl], siteDir);
  }

  for (const name of ['index.html', 'css', 'js']) {
    const src = join(root, name);
    if (existsSync(src)) {
      cpSync(src, join(siteDir, name), { recursive: true });
    }
  }

  const noJekyll = join(siteDir, '.nojekyll');
  if (!existsSync(noJekyll)) {
    writeFileSync(noJekyll, '');
  }

  run('git', ['add', '-A'], siteDir);
  const status = runCapture('git', ['status', '--porcelain'], siteDir);
  if (!status) {
    console.log(`No changes to deploy on '${branch}'.`);
    process.exit(0);
  }

  run('git', ['commit', '-m', `Deploy site ${new Date().toISOString()}`], siteDir);
  run('git', ['push', '-u', 'origin', branch], siteDir);

  console.log('');
  console.log(`Deployed to branch '${branch}'.`);
  console.log('Enable GitHub Pages with: Settings -> Pages -> Deploy from a branch -> gh-pages /(root)');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
