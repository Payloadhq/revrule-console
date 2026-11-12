/**
 * Zero-dependency test runner: compile the API client with the repo's own
 * TypeScript, then run the node:test suite against the compiled output.
 */
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'test', '.build');
rmSync(outDir, { recursive: true, force: true });

const tsc = join(root, 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(
  process.execPath,
  [
    tsc,
    join(root, 'src', 'api', 'client.ts'),
    '--ignoreConfig',
    '--outDir', outDir,
    '--module', 'esnext',
    '--moduleResolution', 'bundler',
    '--target', 'es2022',
    '--skipLibCheck',
  ],
  { stdio: 'inherit' },
);

execFileSync(process.execPath, ['--test', join(root, 'test', 'client.test.mjs')], {
  stdio: 'inherit',
});
