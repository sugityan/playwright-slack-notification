import { NetworkError, SlackApiError } from './errors.ts';
import { sleep } from './utils.ts';

export interface SendBotMessageOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
}

export interface SlackBotMessagePayload {
  channel: string;
  text: string;
  threadTs?: string;
}

type SlackBotApiResponse = {
  ok: boolean;
  error?: string;
  ts?: string;
};

function isTransientStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function isRetryableSlackError(code?: string): boolean {
  return code === 'ratelimited' || code === 'internal_error';
}

function parseResponseBody(text: string): SlackBotApiResponse | undefined {
  try {
    return JSON.parse(text) as SlackBotApiResponse;
  } catch {
    return undefined;
  }
}

export async function sendSlackBotMessage(
  botToken: string,
  payload: SlackBotMessagePayload,
  options: SendBotMessageOptions,
): Promise<{ ts?: string }> {
  const { timeoutMs, retries, retryDelayMs } = options;

  for (const attempt of Array.from({ length: retries + 1 }, (_, index) => index)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          authorization: `Bearer ${botToken}`,
        },
        body: JSON.stringify({
          channel: payload.channel,
          text: payload.text,
          thread_ts: payload.threadTs,
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      if (!response.ok) {
        const retryable = isTransientStatus(response.status);

        if (attempt < retries && retryable) {
          await sleep(retryDelayMs);
          continue;
        }

        throw new SlackApiError(`Slack Bot API Error: ${response.status} ${responseText}`, {
          status: response.status,
          responseBody: responseText,
          retryable,
        });
      }

      const result = parseResponseBody(responseText);
      if (!result?.ok) {
        const code = result?.error;
        const retryable = isRetryableSlackError(code);

        if (attempt < retries && retryable) {
          await sleep(retryDelayMs);
          continue;
        }

        throw new SlackApiError(`Slack Bot API Error: ${code ?? 'unknown_error'}`, {
          status: response.status,
          responseBody: responseText,
          code,
          retryable,
        });
      }

      return { ts: result.ts };
    } catch (error) {
      if (error instanceof SlackApiError) {
        throw error;
      }

      if (attempt < retries) {
        await sleep(retryDelayMs);
        continue;
      }

      console.error('Slack Bot message send failed:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw new NetworkError('Network error while sending Slack Bot message', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new NetworkError('Failed to send Slack Bot message');
}
