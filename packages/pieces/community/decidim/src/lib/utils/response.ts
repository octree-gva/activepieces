type SuccessResponse<T> = T & { ok: true; error: null };
type ErrorResponse<T> = T & { ok: false; error: string };

export type Response<T> = SuccessResponse<T> | ErrorResponse<T>;

export type ErrorInput =
  | string
  | {
      message: string;
      details?: Record<string, unknown>;
    };

export function response<T extends Record<string, unknown>>(
  payload: T,
  errorMessage: ErrorInput | null = null
): Response<T> {
  if (errorMessage === null) {
    return {
      ...payload,
      ok: true,
      error: null,
    };
  }
  if (typeof errorMessage === 'string') {
    return {
      ...payload,
      ok: false,
      error: errorMessage,
    };
  }
  return {
    ...payload,
    ...(errorMessage.details ?? {}),
    ok: false,
    error: errorMessage.message,
  };
}
