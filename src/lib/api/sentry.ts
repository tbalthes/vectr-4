// Sentry scaffold (no-op) - replace with a real implementation when adding @sentry/node
let _initialized = false;

export function initSentry(): void {
  if (_initialized) {
    return;
  }
  _initialized = true;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // No-op: Sentry not configured
    return;
  }
  // If you add @sentry/node, initialize it here. For now we intentionally do not require it at runtime.
  // Example (once installed):
  // (async () => { const Sentry = await import('@sentry/node'); Sentry.init({ dsn }); })();

  console.warn('SENTRY_DSN present but @sentry/node is not initialized (optional).');
}

export function captureException(err: unknown, ctx?: Record<string, any>) {
  // Default: log to console so errors are visible in dev; replace with Sentry capture when integrated.

  console.error('captureException (noop):', err, ctx);
}
