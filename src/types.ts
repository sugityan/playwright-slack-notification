export type SlackBlock = Record<string, unknown>;
export type SlackAttachment = Record<string, unknown>;

export interface NotificationOptions {
  /** Slack Incoming Webhook URL. If omitted, reads from process.env.SLACK_WEBHOOK_URL. */
  webhookUrl?: string;

  /** Optional channel override. May be ignored depending on your Slack webhook configuration. */
  channel?: string;

  /** Slack Block Kit blocks */
  blocks?: SlackBlock[];

  /** Legacy attachments */
  attachments?: SlackAttachment[];

  /** Request timeout (ms). Default: 10_000 */
  timeoutMs?: number;

  /** How many times to retry transient failures (429/5xx/network). Default: 2 */
  retries?: number;

  /** Delay between retries (ms). Default: 500 */
  retryDelayMs?: number;
}

export interface SlackWebhookPayload {
  text: string;
  channel?: string;
  thread_ts?: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}
