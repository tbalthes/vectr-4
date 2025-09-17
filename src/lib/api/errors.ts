export function apiError(code: string, message: string, status = 400) {
  return { ok: false, error: { code, message }, status } as const;
}

export function throwApiError(code: string, message: string, status = 400) {
  const err: any = new Error(message);
  err.code = code;
  err.status = status;
  throw err;
}
