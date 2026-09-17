import { spawn } from 'node:child_process';

const scriptName = process.argv.includes('--dev') ? 'dev' : 'start';
const services = [
  { name: 'backend', directory: 'backend' },
  { name: 'frontend', directory: 'frontend' },
];

let shuttingDown = false;
const children = services.map(({ name, directory }) => {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : 'npm';
  const args = npmCli
    ? [npmCli, '--prefix', directory, 'run', scriptName]
    : ['--prefix', directory, 'run', scriptName];
  const child = spawn(
    command,
    args,
    { stdio: 'inherit', shell: !npmCli && process.platform === 'win32' },
  );

  child.on('error', (error) => {
    console.error(`[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal) console.error(`[${name}] stopped by signal ${signal}`);
    else if (code !== 0) console.error(`[${name}] exited with code ${code}`);
    shutdown(code ?? 1);
  });

  return child;
});

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }

  setTimeout(() => process.exit(exitCode), 500).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
