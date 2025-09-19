import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { logger } from '@/lib/status_logging/logger';
import { validateBody } from '@/lib/api/validator';
import { runTransactionsSync } from '@/lib/plaid/sync';
import { logApiCall } from '@/lib/monitoring/api-usage-tracker';

// In-memory circuit breaker state (in production, use Redis or database)
const circuitBreaker = new Map<string, { 
  failures: number; 
  lastFailure: number; 
  state: 'closed' | 'open' | 'half-open' 
}>();

const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: parseInt(process.env.SYNC_CIRCUIT_BREAKER_FAILURES || '5', 10),
  timeout: parseInt(process.env.SYNC_CIRCUIT_BREAKER_TIMEOUT_MS || '60000', 10), // 1 minute
  resetTime: parseInt(process.env.SYNC_CIRCUIT_BREAKER_RESET_MS || '300000', 10), // 5 minutes
};

function checkCircuitBreaker(itemId: string): { allowed: boolean; reason?: string } {
  const key = `sync:${itemId}`;
  const breaker = circuitBreaker.get(key);
  
  if (!breaker || breaker.state === 'closed') {
    return { allowed: true };
  }
  
  const now = Date.now();
  
  if (breaker.state === 'open') {
    if (now - breaker.lastFailure > CIRCUIT_BREAKER_CONFIG.resetTime) {
      // Transition to half-open to test if service recovered
      breaker.state = 'half-open';
      breaker.failures = 0;
      logger.info({ 
        event: 'circuit_breaker.half_open', 
        item_id: itemId 
      }, 'Circuit breaker transitioning to half-open');
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: `Circuit breaker open due to ${breaker.failures} failures. Retry after ${new Date(breaker.lastFailure + CIRCUIT_BREAKER_CONFIG.resetTime).toISOString()}` 
    };
  }
  
  // half-open state
  return { allowed: true };
}

function recordCircuitBreakerResult(itemId: string, success: boolean): void {
  const key = `sync:${itemId}`;
  const breaker = circuitBreaker.get(key) || { failures: 0, lastFailure: 0, state: 'closed' as const };
  
  if (success) {
    if (breaker.state === 'half-open') {
      // Recovery confirmed, reset to closed
      breaker.state = 'closed';
      breaker.failures = 0;
      logger.info({ 
        event: 'circuit_breaker.closed', 
        item_id: itemId 
      }, 'Circuit breaker reset to closed after successful request');
    }
    // For closed state, we don't reset failure count to allow gradual recovery
  } else {
    breaker.failures++;
    breaker.lastFailure = Date.now();
    
    if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      breaker.state = 'open';
      logger.warn({ 
        event: 'circuit_breaker.open', 
        item_id: itemId, 
        failures: breaker.failures 
      }, 'Circuit breaker opened due to repeated failures');
    }
  }
  
  circuitBreaker.set(key, breaker);
}

// Schema for validation
const SyncSchema = z.object({
  access_token: z.string().min(1),
  cursor: z.string().nullable().optional(),
  count: z.number().int().positive().max(500).optional(),
  user_id: z.string().min(1),
  item_id: z.string().min(1),
});

// POST /api/aggregator/plaid/transactions/sync
// Thin controller: validate → circuit breaker → service → respond
export async function POST(req: Request) {
  let itemId: string | undefined;
  const startTime = Date.now();
  
  try {
    const body = await req.json().catch(() => ({}));
    const { access_token, cursor, count, user_id, item_id } = validateBody(SyncSchema, body) as any;
    
    itemId = item_id;

    // Log API call for monitoring
    logApiCall({
      endpoint: '/api/aggregator/plaid/transactions/sync',
      itemId: item_id,
      userId: user_id,
    });

    // Check circuit breaker before processing
    const circuitCheck = checkCircuitBreaker(item_id);
    if (!circuitCheck.allowed) {
      logger.warn({
        event: 'sync.circuit_breaker_blocked',
        item_id,
        reason: circuitCheck.reason,
      }, 'Sync request blocked by circuit breaker');
      
      return NextResponse.json(
        { 
          ok: false, 
          error: 'Service temporarily unavailable', 
          reason: circuitCheck.reason,
          circuit_breaker: 'open'
        }, 
        { status: 503 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const summary = await runTransactionsSync({
      client: supabase,
      access_token,
      user_id,
      item_id,
      start_cursor: cursor ?? null,
      pageSize: count ?? 100,
    });

    // Record successful operation
    recordCircuitBreakerResult(item_id, true);

    // Log completion with duration
    const duration = Date.now() - startTime;
    logApiCall({
      endpoint: '/api/aggregator/plaid/transactions/sync',
      itemId: item_id,
      userId: user_id,
      duration,
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    // Record failed operation
    if (itemId) {
      recordCircuitBreakerResult(itemId, false);
    }
    
    // Log failed call
    const duration = Date.now() - startTime;
    logApiCall({
      endpoint: '/api/aggregator/plaid/transactions/sync',
      itemId,
      duration,
    });
    
    logger.error(
      { 
        event: 'sync.route.unhandled', 
        item_id: itemId,
        error: { 
          message: (err as Error)?.message || 'Unknown error',
          stack: (err as Error)?.stack
        } 
      },
      'Unhandled error in sync route',
    );
    return NextResponse.json({ ok: false, error: 'Unhandled error' }, { status: 500 });
  }
}

/**
 * Map Plaid personal finance category to system category
 */
async function mapPlaidCategoryToSystem(supabase: any, plaidCategory: any): Promise<string | null> {
  // Add debug logging
  console.log('🏷️ Mapping Plaid category:', {
    primary: plaidCategory?.primary,
    detailed: plaidCategory?.detailed,
    confidence_level: plaidCategory?.confidence_level,
  });

  if (!plaidCategory?.primary || !plaidCategory?.detailed) {
    console.log('❌ Missing primary or detailed category');
    return null;
  }

  try {
    // Try to find EXACT match for detailed category first (this should work!)
    const { data: exactMatch, error: exactError } = await supabase
      .from('categories')
      .select('category_id, category')
      .eq('category', plaidCategory.detailed) // EXACT match, not ilike
      .is('user_id', null) // System categories only
      .maybeSingle();

    console.log('🔍 Exact detailed match query:', {
      query: plaidCategory.detailed,
      exactMatch,
      exactError,
    });

    if (exactMatch) {
      console.log('✅ Found exact detailed match:', exactMatch.category);
      return exactMatch.category_id;
    }

    // Try exact match for primary category
    const { data: primaryMatch, error: primaryError } = await supabase
      .from('categories')
      .select('category_id, category')
      .eq('category', plaidCategory.primary) // EXACT match, not ilike
      .is('user_id', null) // System categories only
      .maybeSingle();

    console.log('🔍 Primary match query:', {
      query: plaidCategory.primary,
      primaryMatch,
      primaryError,
    });

    if (primaryMatch) {
      console.log('✅ Found primary match:', primaryMatch.category);
      return primaryMatch.category_id;
    }

    // List available categories for debugging
    const { data: allCategories, error: listError } = await supabase
      .from('categories')
      .select('category')
      .is('user_id', null)
      .limit(10);

    console.log('🔍 Categories list query:', { allCategories, listError });
    console.log(
      '⚠️ No category match found. Available categories:',
      allCategories?.map((c: any) => c.category),
    );

    // Default to "UNCATEGORIZED" category (matching your table structure)
    const { data: uncategorizedCategory } = await supabase
      .from('categories')
      .select('category_id')
      .eq('category', 'UNCATEGORIZED')
      .is('user_id', null)
      .maybeSingle();

    if (uncategorizedCategory) {
      console.log("🔄 Using fallback 'UNCATEGORIZED' category");
      return uncategorizedCategory.category_id;
    }

    console.log("❌ No 'UNCATEGORIZED' category found either!");
    return null;
  } catch (error) {
    console.warn('Error mapping Plaid category:', error);
    return null;
  }
}

/**
 * Find or create merchant based on transaction data
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function findOrCreateMerchant(
  supabase: any,
  transaction: any,
  _userId: string, // Mark as unused with underscore
): Promise<string | null> {
  // First try to find merchant by name
  const merchantName =
    transaction.merchant_name || extractMerchantFromDescription(transaction.name);

  if (!merchantName) {
    return null;
  }

  // Look for existing merchant
  const { data: existingMerchant } = await supabase
    .from('merchants')
    .select('merchant_id')
    .ilike('name', merchantName)
    .single();

  if (existingMerchant) {
    return existingMerchant.merchant_id;
  }

  // Create new merchant if not found
  try {
    const { data: newMerchant, error } = await supabase
      .from('merchants')
      .insert({
        name: merchantName,
        default_category_id: await mapPlaidCategoryToSystem(
          supabase,
          transaction.personal_finance_category,
        ),
        logo_url: transaction.logo_url || null, // Store Plaid merchant logo
        regex_match: `.*${merchantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`,
        confidence_score: 0.8,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select('merchant_id')
      .single();

    if (error) {
      console.warn('Failed to create merchant:', error);
      return null;
    }

    return newMerchant?.merchant_id || null;
  } catch (createError) {
    console.warn('Error creating merchant:', createError);
    return null;
  }
}

/**
 * Extract merchant name from transaction description
 */
function extractMerchantFromDescription(description: string): string | null {
  if (!description) {
    return null;
  }

  // Clean up common prefixes/suffixes
  const cleaned = description
    .replace(/^(DEBIT|CREDIT|ACH|WIRE|CHECK|ATM)\s+/i, '')
    .replace(/\s+(PAYMENT|PURCHASE|WITHDRAWAL|DEPOSIT|FEE)$/i, '')
    .replace(/\s+\d{4}$/, '') // Remove trailing card numbers
    .replace(/\s+[A-Z]{2}$/, '') // Remove state codes
    .trim();

  // Take first meaningful part
  const parts = cleaned.split(/\s+/);
  const meaningfulParts = parts.filter(
    (part) => part.length > 2 && !/^\d+$/.test(part) && !/^[A-Z]{1,3}$/.test(part),
  );

  return meaningfulParts.slice(0, 2).join(' ') || cleaned;
}
