import { spawn } from 'node:child_process';

const children = [
  spawn(
    process.execPath,
    ['--watch', '--import', 'tsx', 'src/core/api/server.ts'],
    { stdio: 'inherit' },
  ),
  spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--config', 'web/vite.config.ts'],
    { stdio: 'inherit' },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
}
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', (code) => stop(code ?? 0));
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
