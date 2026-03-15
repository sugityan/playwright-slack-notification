import { NetworkError, SlackApiError } from './errors.js';
import type { SlackWebhookPayload } from './types.js';
import { sleep, toInt } from './utils.js';

export interface SendWebhookOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export async function sendSlackWebhook(
  webhookUrl: string,
  payload: SlackWebhookPayload,
  options: SendWebhookOptions,
): Promise<void> {
  const { timeoutMs, retries, retryDelayMs } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (res.ok) {
        // Slack typically responds with "ok".
        // We intentionally ignore the response body.
        await res.text().catch(() => undefined);
        return;
      }

      const responseBody = await res.text().catch(() => undefined);

      if (attempt < retries && isTransientStatus(res.status)) {
        if (res.status === 429) {
          const retryAfterSeconds = toInt(res.headers.get('retry-after'));
          const delay = retryAfterSeconds !== undefined ? retryAfterSeconds * 1000 : retryDelayMs;
          await sleep(delay);
        } else {
          await sleep(retryDelayMs);
        }
        continue;
      }

      throw new SlackApiError('Slack webhook request failed', {
        status: res.status,
        responseBody,
      });
    } catch (err) {
      lastError = err;

      // If the error is already a SlackApiError, don't retry unless it's transient.
      if (err instanceof SlackApiError) {
        if (attempt < retries && isTransientStatus(err.status)) {
          await sleep(retryDelayMs);
          continue;
        }
        throw err;
      }

      if (attempt < retries) {
        await sleep(retryDelayMs);
        continue;
      }

      throw new NetworkError('Network error while sending Slack webhook', { cause: err });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new NetworkError('Failed to send Slack webhook', { cause: lastError });
}
