export class SlackNotificationError extends Error {
  override name = 'SlackNotificationError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      // `cause` is supported in modern Node, but keep assignment explicit.
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class ValidationError extends SlackNotificationError {
  override name = 'ValidationError';

  constructor(message: string) {
    super(message);
  }
}

export class SlackApiError extends SlackNotificationError {
  override name = 'SlackApiError';

  readonly status: number;
  readonly responseBody?: string;
  readonly code?: string;
  readonly retryable?: boolean;

  constructor(message: string, options: { status: number; responseBody?: string; code?: string; retryable?: boolean }) {
    super(message);
    this.status = options.status;
    this.responseBody = options.responseBody;
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

export class NetworkError extends SlackNotificationError {
  override name = 'NetworkError';

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}
