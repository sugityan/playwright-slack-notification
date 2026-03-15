import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

type Failure = {
  title: string;
  project?: string;
  location?: string;
  error?: string;
};

export default class SlackOnFailureReporter implements Reporter {
  private failures: Failure[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

    const title = test.titlePath().join(' › ');
    const project = test.parent.project()?.name;
    const location = test.location
      ? `${test.location.file}:${test.location.line}:${test.location.column}`
      : undefined;
    const error = result.error?.message;

    this.failures.push({ title, project, location, error });
  }

  async onEnd(result: FullResult) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.trim().length === 0) return;

    const notifyMode = (process.env.PLAYWRIGHT_SLACK_NOTIFY ?? 'failure').toLowerCase();

    // If Playwright didn't record failures but overall status isn't passed, still notify.
    const shouldNotify =
      notifyMode === 'always' ? true : this.failures.length > 0 || result.status !== 'passed';
    if (!shouldNotify) return;

    // Build a compact message (plain text) suitable for Incoming Webhooks.
    const header = `Playwright E2E result: ${result.status} (failures: ${this.failures.length})`;

    const repo = process.env.GITHUB_REPOSITORY;
    const sha = process.env.GITHUB_SHA;
    const runId = process.env.GITHUB_RUN_ID;
    const serverUrl = process.env.GITHUB_SERVER_URL;

    const runUrl =
      repo && runId && serverUrl ? `${serverUrl}/${repo}/actions/runs/${runId}` : undefined;

    const lines: string[] = [header];
    if (repo) lines.push(`repo: ${repo}`);
    if (sha) lines.push(`sha: ${sha}`);
    if (runUrl) lines.push(`run: ${runUrl}`);

    if (this.failures.length > 0) {
      lines.push('failures:');
      for (const failure of this.failures.slice(0, 5)) {
        const where = [failure.project, failure.location].filter(Boolean).join(' ');
        lines.push(`- ${failure.title}${where ? ` (${where})` : ''}`);
        if (failure.error) {
          const firstLine = failure.error.split('\n')[0].trim();
          if (firstLine) lines.push(`  ${firstLine}`);
        }
      }
      if (this.failures.length > 5) {
        lines.push(`...and ${this.failures.length - 5} more`);
      }
    }

    const message = lines.join('\n');

    try {
      // Dynamic import so running `playwright test` without building doesn't crash the run.
      const mod: any = await import('../lib/index.js');
      const sendNotification: ((msg: string) => Promise<void>) | undefined =
        mod?.sendNotification ?? mod?.default?.sendNotification;

      if (typeof sendNotification !== 'function') {
        // eslint-disable-next-line no-console
        console.warn('Slack reporter: sendNotification export not found (did you run `npm run build`?)');
        return;
      }

      await sendNotification(message);
    } catch (err) {
      // Never fail the test run due to Slack notification issues.
      // eslint-disable-next-line no-console
      console.warn('Slack reporter: failed to send notification');
      // eslint-disable-next-line no-console
      console.warn(err);
    }
  }
}
