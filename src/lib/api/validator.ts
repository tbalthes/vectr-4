import type { ZodSchema } from 'zod';

/**
 * Validate a request body with a Zod schema. Throws an Error with a JSON payload on validation failure.
 */
export function validateBody<T extends ZodSchema>(schema: T, body: unknown) {
  const parsed = (schema as any).safeParse(body);
  if (!parsed.success) {
    const err = { code: 'invalid_body', issues: parsed.error.format() };
    const e = new Error('Invalid request body');
    // attach metadata for callers
    (e as any).details = err;
    throw e;
  }
  return parsed.data as unknown;
}

export function parseJsonOrThrow(req: Request) {
  return req.json();
}
