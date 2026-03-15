import { ValidationError } from './errors.ts';

export function getEnv(name: string): string | undefined {
  return process.env[name];
}

export function validateNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} must be a non-empty string`);
  }
}

export function validateWebhookUrl(url: string): void {
  validateNonEmptyString(url, 'webhookUrl');

  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      throw new ValidationError('webhookUrl must be a valid URL');
    }
  })();

  if (parsed.protocol !== 'https:') {
    throw new ValidationError('webhookUrl must use https');
  }

}

export async function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms <= 0) return;
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function toInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) return undefined;
  return num;
}
