type SuccessResponse<T> = T & { ok: true; error: null };
type ErrorResponse<T> = T & { ok: false; error: string };

export type Response<T> = SuccessResponse<T> | ErrorResponse<T>;

export function response<T extends Record<string, any>>(
  payload: T,
  errorMessage: string | null = null
): Response<T> {
  if (errorMessage === null) {
    return {
      ...payload,
      ok: true,
      error: null,
    } as SuccessResponse<T>;
  }
  return {
    ...payload,
    ok: false,
    error: errorMessage,
  } as ErrorResponse<T>;
}
