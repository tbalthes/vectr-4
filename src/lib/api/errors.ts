import 'server-only';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { logger } from '@/lib/status_logging/logger';

// Standardized error response shape
export interface ErrorResponse {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

// Base error class for API errors
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
    public meta?: Record<string, any>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Specific error classes
export class ValidationError extends ApiError {
  constructor(message: string, meta?: Record<string, any>) {
    super('validation_error', message, 400, meta);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required', meta?: Record<string, any>) {
    super('unauthorized', message, 401, meta);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Access forbidden', meta?: Record<string, any>) {
    super('forbidden', message, 403, meta);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', meta?: Record<string, any>) {
    super('not_found', message, 404, meta);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message = 'Resource conflict', meta?: Record<string, any>) {
    super('conflict', message, 409, meta);
    this.name = 'ConflictError';
  }
}

export class RateLimitedError extends ApiError {
  constructor(message = 'Rate limit exceeded', meta?: Record<string, any>) {
    super('rate_limited', message, 429, meta);
    this.name = 'RateLimitedError';
  }
}

export class InternalError extends ApiError {
  constructor(message = 'Internal server error', meta?: Record<string, any>) {
    super('internal_error', message, 500, meta);
    this.name = 'InternalError';
  }
}

// Error mapping table
const ERROR_STATUS_MAP: Record<string, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal_error: 500,
};

/**
 * Redact sensitive data from objects before logging
 */
function redactSensitiveData(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const sensitiveFields = [
    'access_token', 'refresh_token', 'client_secret', 'password', 
    'authorization', 'x-api-key', 'plaid-verification'
  ];

  const redacted = { ...obj };
  
  for (const key of Object.keys(redacted)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveFields.some(field => lowerKey.includes(field))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object') {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }
  
  return redacted;
}

/**
 * Get request ID from headers for correlation
 */
function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') || 'unknown';
}

/**
 * Wrapper for API route handlers that provides standardized error handling
 */
export function withErrorHandling<T>(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse<T>> | NextResponse<T>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = getRequestId(req);
    const route = req.nextUrl.pathname;
    
    try {
      const result = handler(req, context);
      // Handle both sync and async handlers
      return result instanceof Promise ? await result : result;
    } catch (error: any) {
      let apiError: ApiError;
      
      // Convert known error types to ApiError
      if (error instanceof ApiError) {
        apiError = error;
      } else if (error.name === 'ValidationError' || error.code === 'validation_error') {
        apiError = new ValidationError(error.message, error.meta);
      } else if (error.name === 'UnauthorizedError' || error.code === 'unauthorized') {
        apiError = new UnauthorizedError(error.message, error.meta);
      } else if (error.name === 'ForbiddenError' || error.code === 'forbidden') {
        apiError = new ForbiddenError(error.message, error.meta);
      } else if (error.name === 'NotFoundError' || error.code === 'not_found') {
        apiError = new NotFoundError(error.message, error.meta);
      } else if (error.name === 'ConflictError' || error.code === 'conflict') {
        apiError = new ConflictError(error.message, error.meta);
      } else if (error.name === 'RateLimitedError' || error.code === 'rate_limited') {
        apiError = new RateLimitedError(error.message, error.meta);
      } else {
        // Unknown error - map to internal error
        apiError = new InternalError('An unexpected error occurred');
      }

      // Log the error with redacted sensitive data
      const logContext = {
        event: 'api.error',
        requestId,
        route,
        errorCode: apiError.code,
        errorName: apiError.name,
        statusCode: apiError.httpStatus,
        error: redactSensitiveData({
          message: error.message,
          stack: error.stack,
          ...error
        })
      };

      if (apiError.httpStatus >= 500) {
        logger.error(logContext, 'API error occurred');
        
        // Capture to Sentry for 5xx errors
        try {
          const { captureException } = await import('@/lib/api/sentry');
          captureException(error, {
            requestId,
            route,
            errorCode: apiError.code
          });
        } catch (sentryError) {
          logger.warn({ event: 'sentry.capture_failed', error: sentryError }, 'Failed to capture error to Sentry');
        }
      } else {
        logger.warn(logContext, 'API client error occurred');
      }

      // Return standardized error response
      const response: ErrorResponse = {
        ok: false,
        error: {
          code: apiError.code,
          message: apiError.message
        }
      };

      return NextResponse.json(response, { 
        status: apiError.httpStatus,
        headers: {
          'x-request-id': requestId
        }
      });
    }
  };
}

// Legacy functions for backward compatibility
export function apiError(code: string, message: string, status = 400) {
  return { ok: false, error: { code, message }, status } as const;
}

export function throwApiError(code: string, message: string, status = 400) {
  const httpStatus = ERROR_STATUS_MAP[code] || status;
  throw new ApiError(code, message, httpStatus);
}

// Type guard to check if error is an ApiError
export function isApiError(error: any): error is ApiError {
  return error instanceof ApiError;
}
