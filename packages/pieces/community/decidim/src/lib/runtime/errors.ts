import axios from 'axios';
import type { ZodIssue } from 'zod';

function zodIssues(e: unknown): ZodIssue[] | null {
  if (!e || typeof e !== 'object' || !('issues' in e)) return null;
  const { issues } = e as { issues: unknown };
  return Array.isArray(issues) ? (issues as ZodIssue[]) : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function humanMessageFromBody(data: Record<string, unknown>): string | null {
  if (typeof data.error_description === 'string' && data.error_description.length > 0) {
    return data.error_description;
  }
  if (typeof data.message === 'string' && data.message.length > 0) {
    return data.message;
  }
  if (typeof data.error === 'string' && data.error.length > 0) {
    return data.error;
  }
  return null;
}

export function getErrorMessage(e: unknown): ErrorInfo {
  const issues = zodIssues(e);
  if (issues && issues.length > 0) {
    return { message: issues.map((i) => i.message).join(' ') };
  }
  if (axios.isAxiosError(e)) {
    const data = e.response?.data;
    if (isPlainObject(data)) {
      return {
        message: humanMessageFromBody(data) ?? e.message,
        details: data,
      };
    }
    if (typeof data === 'string' && data.length > 0) {
      return { message: data };
    }
    return { message: e.message };
  }
  return { message: e instanceof Error ? e.message : String(e) };
}

export function rethrowAxiosError(e: unknown): void {
  if (axios.isAxiosError(e)) {
    throw e;
  }
}

export type ErrorInfo = {
  message: string;
  details?: Record<string, unknown>;
};
