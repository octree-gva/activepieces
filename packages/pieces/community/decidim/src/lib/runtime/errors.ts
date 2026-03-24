import axios from 'axios';
import type { ZodIssue } from 'zod';

function zodIssues(e: unknown): ZodIssue[] | null {
  if (!e || typeof e !== 'object' || !('issues' in e)) return null;
  const { issues } = e as { issues: unknown };
  return Array.isArray(issues) ? (issues as ZodIssue[]) : null;
}

/**
 * Turn thrown values into a single string for `response(..., error)`.
 * Axios and Zod errors get structured detail; other Errors use `.message`.
 */
export function getErrorMessage(e: unknown): string {
  const issues = zodIssues(e);
  if (issues && issues.length > 0) {
    return issues.map((i) => i.message).join(' ');
  }
  if (axios.isAxiosError(e)) {
    const data = e.response?.data;
    if (data && typeof data === 'object') {
      return JSON.stringify(data);
    }
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}
