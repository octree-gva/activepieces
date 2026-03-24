import { z } from 'zod';

export const upsertBySchema = z.enum(['extended_data', 'nickname', 'email']);

export function splitJsonPath(path: string): string[] {
  const normalized = path.trim();
  if (!normalized || normalized === '.') {
    return [];
  }
  return normalized.split('.').map((part) => part.trim()).filter(Boolean);
}

export function buildNestedObject(path: string, value: unknown): Record<string, unknown> {
  const parts = splitJsonPath(path);
  if (parts.length === 0) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    throw new Error('jsonPath "." requires an object value');
  }

  let current: Record<string, unknown> = { [parts[parts.length - 1]]: value };
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    current = { [parts[index]]: current };
  }
  return current;
}

export function toExtendedDataSearchQuery(path: string, value: unknown): string {
  const nested = buildNestedObject(path, value);
  return JSON.stringify(nested).replace(/":/g, '": ');
}

export function fallbackNickname(input: {
  nickname?: string;
  email?: string;
  matchValue?: string;
}): string {
  if (input.nickname?.trim()) return input.nickname.trim();

  if (input.email?.trim()) {
    const [left] = input.email.trim().split('@');
    if (left) return sanitizeNickname(left);
  }

  if (input.matchValue?.trim()) {
    return `participant_${sanitizeNickname(input.matchValue)}`.slice(0, 30);
  }

  throw new Error('Nickname is required (or derivable from email/match value)');
}

function sanitizeNickname(raw: string): string {
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'participant';
}
