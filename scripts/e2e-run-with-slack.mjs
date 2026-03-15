import { spawn } from 'node:child_process';

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('exit', (code, signal) => {
      if (signal) return resolve(1);
      resolve(code ?? 1);
    });
  });
}

const webhookUrl = process.env.SLACK_WEBHOOK_URL;
if (!webhookUrl || webhookUrl.trim().length === 0) {
  console.error('Missing SLACK_WEBHOOK_URL. Put it in .env and run: npm run test:e2e:slack');
  process.exit(1);
}

// Always notify the overall result after the run.
process.env.PLAYWRIGHT_SLACK_NOTIFY = process.env.PLAYWRIGHT_SLACK_NOTIFY ?? 'always';

const extraArgs = process.argv.slice(2);

const buildExit = await run('npm', ['run', 'build']);
if (buildExit !== 0) process.exit(buildExit);

// Use `npx playwright test` to ensure the local Playwright CLI is used.
const testExit = await run('npx', ['playwright', 'test', ...extraArgs], {
  env: process.env,
});

process.exit(testExit);
