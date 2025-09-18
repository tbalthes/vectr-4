import { NextRequest } from 'next/server';

import { withErrorHandling, ValidationError, NotFoundError } from '@/lib/api/errors';

/**
 * Example API route demonstrating standardized error handling
 * This demonstrates WBS section 6.1.2 - withErrorHandling wrapper
 */
async function handler(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const testType = searchParams.get('test');

  switch (testType) {
    case 'validation':
      throw new ValidationError('Invalid input provided', { field: 'test' });
    case 'not_found':
      throw new NotFoundError('Resource not found');
    case 'internal':
      throw new Error('Unexpected error');
    default:
      return Response.json({ 
        ok: true, 
        message: 'Error handling test endpoint',
        availableTests: ['validation', 'not_found', 'internal']
      });
  }
}

export const GET = withErrorHandling(handler);