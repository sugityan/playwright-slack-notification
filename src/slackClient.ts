import { NetworkError, SlackApiError } from './errors.ts';
import type { SlackWebhookPayload } from './types.ts';
import { sleep, toInt } from './utils.ts';

export interface SendWebhookOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
}

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

const KNOWN_NON_RETRYABLE_ERRORS: Record<string, string> = {
  action_prohibited:
    'Workspace policy prohibits posting via this webhook. Do not retry until admin settings are changed.',
  channel_is_archived: 'Target channel is archived and does not accept new messages.',
  invalid_payload: 'Payload is malformed. Fix payload formatting before retrying.',
  invalid_token: 'Webhook token is invalid or expired.',
  no_active_hooks: 'Incoming webhook is disabled.',
  no_service: 'Incoming webhook is disabled, removed, or invalid.',
  no_service_id: 'Incoming webhook service identifier is invalid or missing.',
  no_team: 'Slack workspace identifier is invalid or missing.',
  no_text: 'Payload is missing text.',
  posting_to_general_channel_denied:
    'Posting to #general is restricted and webhook owner is not authorized for that channel.',
  team_disabled: 'Slack workspace is disabled.',
  too_many_attachments: 'Payload contains more than 100 attachments.',
  user_not_found: 'Target user does not exist or is invalid.',
  channel_not_found: 'Target channel does not exist or is invalid.',
};

function parseSlackErrorCode(responseBody?: string): string | undefined {
  if (!responseBody) return undefined;
  const code = responseBody.trim().toLowerCase();
  if (!code) return undefined;
  if (/^[a-z_]+$/.test(code)) return code;
  return undefined;
}

function buildSlackApiErrorMessage(status: number, code?: string): string {
  if (!code) return `Slack webhook request failed (HTTP ${status})`;
  const guidance = KNOWN_NON_RETRYABLE_ERRORS[code];
  if (!guidance) return `Slack webhook request failed (HTTP ${status}): ${code}`;
  return `Slack webhook request failed (HTTP ${status}): ${code}. ${guidance}`;
}

export async function sendSlackWebhook(
  webhookUrl: string,
  payload: SlackWebhookPayload,
  options: SendWebhookOptions,
): Promise<void> {
  const { timeoutMs, retries, retryDelayMs } = options;

  for (const attempt of Array.from({ length: retries + 1 }, (_, index) => index)) {
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
        // Slack success body is not used by this library.
        return;
      }

      const responseBody = await res.text().catch(() => undefined);
      const code = parseSlackErrorCode(responseBody);
      const knownNonRetryable = code !== undefined && KNOWN_NON_RETRYABLE_ERRORS[code] !== undefined;
      const retryable = !knownNonRetryable && isTransientStatus(res.status);

      if (attempt < retries && retryable) {
        if (res.status === 429) {
          const retryAfterSeconds = toInt(res.headers.get('retry-after'));
          const delay = retryAfterSeconds !== undefined ? retryAfterSeconds * 1000 : retryDelayMs;
          await sleep(delay);
        } else {
          await sleep(retryDelayMs);
        }
        continue;
      }

      throw new SlackApiError(buildSlackApiErrorMessage(res.status, code), {
        status: res.status,
        responseBody,
        code,
        retryable,
      });
    } catch (err) {
      // If the error is already a SlackApiError, don't retry unless it's transient.
      if (err instanceof SlackApiError) {
        const retryable = err.retryable ?? isTransientStatus(err.status);
        if (attempt < retries && retryable) {
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

  throw new NetworkError('Failed to send Slack webhook');
}
