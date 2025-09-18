import 'server-only';

/**
 * Sentry integration for error monitoring and observability
 * as outlined in WBS section 6.5.1 and 7.3.1
 */

let _initialized = false;

export interface SentryConfig {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
  beforeSend?: (event: any) => any;
}

export interface SentryContext {
  requestId?: string;
  route?: string;
  userId?: string;
  extra?: Record<string, any>;
}

/**
 * Initialize Sentry with configuration
 */
export async function initSentry(config?: SentryConfig): Promise<void> {
  if (_initialized) {
    return;
  }
  
  _initialized = true;
  
  const dsn = config?.dsn || process.env.SENTRY_DSN;
  if (!dsn) {
    console.info('Sentry DSN not configured - error monitoring disabled');
    return;
  }

  try {
    const Sentry = await import('@sentry/node');
    
    Sentry.init({
      dsn,
      environment: config?.environment || process.env.NODE_ENV || 'development',
      tracesSampleRate: config?.tracesSampleRate || 0.1,
      beforeSend(event) {
        // Apply custom filtering or processing
        if (config?.beforeSend) {
          return config.beforeSend(event);
        }
        
        // Default filtering - remove sensitive data
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers['plaid-verification'];
          delete event.request.headers['x-api-key'];
        }
        
        return event;
      },
      integrations: [
        Sentry.httpIntegration(),
        Sentry.nodeContextIntegration(),
      ],
    });
    
    console.info('Sentry initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize Sentry:', error);
  }
}

/**
 * Capture exception with context
 */
export async function captureException(
  error: unknown, 
  context?: SentryContext
): Promise<void> {
  try {
    const Sentry = await import('@sentry/node');
    
    Sentry.withScope((scope) => {
      // Add context information
      if (context?.requestId) {
        scope.setTag('requestId', context.requestId);
      }
      
      if (context?.route) {
        scope.setTag('route', context.route);
      }
      
      if (context?.userId) {
        // Hash user ID for privacy
        const hashedUserId = hashUserId(context.userId);
        scope.setUser({ id: hashedUserId });
      }
      
      if (context?.extra) {
        Object.entries(context.extra).forEach(([key, value]) => {
          scope.setExtra(key, value);
        });
      }
      
      Sentry.captureException(error);
    });
  } catch (sentryError) {
    // Fallback to console logging if Sentry fails
    console.error('Failed to capture exception to Sentry:', sentryError);
    console.error('Original error:', error, context);
  }
}

/**
 * Add breadcrumb for tracing significant events
 */
export async function addBreadcrumb(
  message: string,
  category: string,
  level: 'info' | 'debug' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): Promise<void> {
  try {
    const Sentry = await import('@sentry/node');
    
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  } catch (error) {
    console.debug('Failed to add Sentry breadcrumb:', error);
  }
}

/**
 * Start a new transaction for performance monitoring
 */
export async function startTransaction(
  name: string,
  op: string,
  context?: SentryContext
): Promise<any> {
  try {
    const Sentry = await import('@sentry/node');
    
    const transaction = Sentry.startTransaction({
      name,
      op,
      tags: {
        requestId: context?.requestId,
        route: context?.route,
      },
    });
    
    return transaction;
  } catch (error) {
    console.debug('Failed to start Sentry transaction:', error);
    return null;
  }
}

/**
 * Hash user ID for privacy compliance
 */
function hashUserId(userId: string): string {
  // Simple hash for privacy - in production, use a proper hash function
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `user_${Math.abs(hash).toString(16)}`;
}

/**
 * Initialize Sentry on module load if DSN is available
 */
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== 'test') {
  initSentry().catch(console.error);
}

export { initSentry as default };
