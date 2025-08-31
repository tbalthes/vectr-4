/**
 * Utility functions for analytics date range calculations
 * Handles named ranges and explicit date overrides for the analytics aggregator API
 */

export interface DateRangeResult {
  startDate: Date;
  endDate: Date;
  granularity: 'day' | 'week' | 'month';
}

export type NamedRange = '7d' | '30d' | '90d' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'all';

/**
 * Calculate date range from named range or explicit overrides
 * All calculations in UTC timezone for consistency
 */
export function calculateDateRange(
  range: NamedRange | string = '30d',
  startOverride?: string | null,
  endOverride?: string | null
): DateRangeResult {
  // If explicit start/end dates provided, use those and ignore range
  if (startOverride && endOverride) {
    const startDate = new Date(startOverride + 'T00:00:00Z');
    const endDate = new Date(endOverride + 'T23:59:59Z');

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format. Use YYYY-MM-DD format.');
    }

    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date.');
    }

    // Determine granularity based on date range span
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const granularity = getGranularityFromRange(daysDiff);

    return { startDate, endDate, granularity };
  }

  // Use named range calculation
  const now = new Date();
  const utcNow = new Date(now.getTime() + now.getTimezoneOffset() * 60000); // Convert to UTC

  let startDate: Date;
  const endDate = new Date(utcNow);
  endDate.setHours(23, 59, 59, 999); // End of day

  switch (range) {
    case '7d':
      startDate = new Date(utcNow);
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0); // Start of day
      return { startDate, endDate, granularity: 'day' };

    case '30d':
      startDate = new Date(utcNow);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'day' };

    case '90d':
      startDate = new Date(utcNow);
      startDate.setDate(startDate.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'day' };

    case '1M':
      startDate = new Date(utcNow);
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'week' };

    case '3M':
      startDate = new Date(utcNow);
      startDate.setMonth(startDate.getMonth() - 3);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'week' };

    case '6M':
      startDate = new Date(utcNow);
      startDate.setMonth(startDate.getMonth() - 6);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'week' };

    case 'YTD':
      startDate = new Date(utcNow.getFullYear(), 0, 1); // January 1st of current year
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'month' };

    case '1Y':
      startDate = new Date(utcNow);
      startDate.setFullYear(startDate.getFullYear() - 1);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'month' };

    case 'all':
      // For 'all', use a reasonable default like 2 years back
      startDate = new Date(utcNow);
      startDate.setFullYear(startDate.getFullYear() - 2);
      startDate.setHours(0, 0, 0, 0);
      return { startDate, endDate, granularity: 'month' };

    default:
      throw new Error(`Invalid range: ${range}. Supported values: 7d, 30d, 90d, 1M, 3M, 6M, YTD, 1Y, all`);
  }
}

/**
 * Determine appropriate granularity based on date range span
 */
function getGranularityFromRange(daysDiff: number): 'day' | 'week' | 'month' {
  if (daysDiff <= 90) {
    return 'day';
  } else if (daysDiff <= 365) {
    return 'week';
  } else {
    return 'month';
  }
}

/**
 * Validate query parameters for the analytics API
 */
export function validateAnalyticsParams(
  range?: string | null,
  start?: string | null,
  end?: string | null
): void {
  // If explicit dates provided, validate them
  if (start || end) {
    if (!(start && end)) {
      throw new Error('Both start and end dates must be provided when using explicit dates.');
    }

    // Date format validation will be handled in calculateDateRange
    return;
  }

  // Validate named range
  if (range) {
    const validRanges: NamedRange[] = ['7d', '30d', '90d', '1M', '3M', '6M', 'YTD', '1Y', 'all'];
    if (!validRanges.includes(range as NamedRange)) {
      throw new Error(`Invalid range: ${range}. Supported values: ${validRanges.join(', ')}`);
    }
  }
}

/**
 * Calculate expected number of buckets for a date range
 * Useful for validation and testing
 */
export function calculateExpectedBuckets(startDate: Date, endDate: Date, granularity: 'day' | 'week' | 'month'): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  switch (granularity) {
    case 'day':
      return diffDays + 1; // +1 because both start and end dates are inclusive
    case 'week':
      return Math.ceil(diffDays / 7) + 1;
    case 'month':
      return Math.abs(
        endDate.getMonth() - startDate.getMonth() +
        (endDate.getFullYear() - startDate.getFullYear()) * 12
      ) + 1;
    default:
      return diffDays + 1;
  }
}