import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logger } from '@/lib/status_logging/logger';
import { createPerformanceContext } from '@/lib/perf';

/**
 * Maintenance scanner for inactive items
 * as outlined in WBS section 8.1
 * 
 * Scans items inactive > 90 days and probes with Plaid API
 * On ITEM_LOGIN_REQUIRED, sets item status = 'disconnected'
 */

export interface ScanOptions {
  thresholdDays?: number;
  limit?: number;
  dryRun?: boolean;
  apply?: boolean;
}

export interface ScanSummary {
  totalScanned: number;
  itemsProbed: number;
  itemsDisconnected: number;
  itemsHealthy: number;
  errors: number;
  duration_ms: number;
}

export interface ProbeResult {
  item_id: string;
  status: 'healthy' | 'disconnected' | 'error';
  error_code?: string;
  error_message?: string;
}

/**
 * Scan inactive items and probe their status
 */
export async function scanInactiveItems(
  supabase: SupabaseClient,
  options: ScanOptions = {}
): Promise<ScanSummary> {
  const {
    thresholdDays = 90,
    limit = 1000,
    dryRun = process.env.NODE_ENV === 'development',
    apply = !dryRun
  } = options;

  const perf = createPerformanceContext({
    requestId: `maintenance-scan-${Date.now()}`,
    route: 'maintenance/scanInactiveItems'
  });

  logger.info({
    event: 'maintenance.scan.start',
    thresholdDays,
    limit,
    dryRun,
    apply
  }, 'Starting inactive items scan');

  perf.start('scan_items');

  try {
    // Find items that haven't been synced in the threshold period
    const thresholdDate = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000);
    
    const { data: inactiveItems, error: queryError } = await supabase
      .from('account_links')
      .select('id, item_id, provider, user_id, status, last_synced_at')
      .eq('provider', 'plaid') // Only probe Plaid items for now
      .or(`last_synced_at.lt.${thresholdDate.toISOString()},last_synced_at.is.null`)
      .in('status', ['active', 'error']) // Don't probe already disconnected items
      .limit(limit);

    if (queryError) {
      throw new Error(`Failed to query inactive items: ${queryError.message}`);
    }

    perf.end('scan_items', { itemsFound: inactiveItems?.length || 0 });

    if (!inactiveItems || inactiveItems.length === 0) {
      logger.info({ event: 'maintenance.scan.no_items' }, 'No inactive items found');
      return {
        totalScanned: 0,
        itemsProbed: 0,
        itemsDisconnected: 0,
        itemsHealthy: 0,
        errors: 0,
        duration_ms: perf.end('scan_items')
      };
    }

    logger.info({
      event: 'maintenance.scan.items_found',
      count: inactiveItems.length
    }, `Found ${inactiveItems.length} inactive items`);

    // Probe each item
    perf.start('probe_items');
    const probeResults: ProbeResult[] = [];
    let itemsDisconnected = 0;
    let itemsHealthy = 0;
    let errors = 0;

    for (const item of inactiveItems) {
      try {
        const result = await probeItem(item);
        probeResults.push(result);

        if (result.status === 'disconnected') {
          itemsDisconnected++;
          
          if (apply) {
            await markItemDisconnected(supabase, item.id, result.error_code || 'ITEM_LOGIN_REQUIRED');
            logger.info({
              event: 'maintenance.scan.item_disconnected',
              item_id: item.item_id,
              error_code: result.error_code
            }, 'Marked item as disconnected');
          } else {
            logger.info({
              event: 'maintenance.scan.item_would_disconnect',
              item_id: item.item_id,
              error_code: result.error_code
            }, 'Would mark item as disconnected (dry run)');
          }
        } else if (result.status === 'healthy') {
          itemsHealthy++;
        } else {
          errors++;
        }

        // Rate limiting: wait between probes to respect Plaid limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errors++;
        logger.error({
          event: 'maintenance.scan.probe_error',
          item_id: item.item_id,
          error: error instanceof Error ? error.message : String(error)
        }, 'Failed to probe item');
      }
    }

    perf.end('probe_items', { itemsProbed: probeResults.length });

    const summary: ScanSummary = {
      totalScanned: inactiveItems.length,
      itemsProbed: probeResults.length,
      itemsDisconnected,
      itemsHealthy,
      errors,
      duration_ms: perf.getSpans().reduce((sum, span) => sum + (span.duration || 0), 0)
    };

    logger.info({
      event: 'maintenance.scan.completed',
      ...summary
    }, 'Inactive items scan completed');

    perf.logSummary(logger, summary);
    return summary;

  } catch (error) {
    perf.end('scan_items');
    logger.error({
      event: 'maintenance.scan.failed',
      error: error instanceof Error ? error.message : String(error)
    }, 'Inactive items scan failed');
    throw error;
  }
}

/**
 * Probe a single item to check its status
 */
async function probeItem(item: any): Promise<ProbeResult> {
  // This would normally call Plaid API, but we'll mock it for now
  // In a real implementation, this would:
  // 1. Decrypt the access_token from the item
  // 2. Call Plaid /accounts/balance/get or /auth/get
  // 3. Handle the response and map error codes
  
  try {
    // Mock implementation - in reality this would call Plaid
    const mockPlaidResponse = await mockPlaidProbe(item.item_id);
    
    if (mockPlaidResponse.error_code === 'ITEM_LOGIN_REQUIRED') {
      return {
        item_id: item.item_id,
        status: 'disconnected',
        error_code: mockPlaidResponse.error_code,
        error_message: 'Item requires user re-authentication'
      };
    }
    
    if (mockPlaidResponse.error_code) {
      return {
        item_id: item.item_id,
        status: 'error',
        error_code: mockPlaidResponse.error_code,
        error_message: mockPlaidResponse.error_message
      };
    }
    
    return {
      item_id: item.item_id,
      status: 'healthy'
    };
    
  } catch (error) {
    return {
      item_id: item.item_id,
      status: 'error',
      error_message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Mock Plaid probe - replace with real Plaid API call
 */
function mockPlaidProbe(itemId: string): Promise<{ error_code?: string; error_message?: string }> {
  // Simulate different scenarios for testing
  const rand = Math.random();
  
  if (itemId.includes('disconnected') || rand < 0.3) {
    return Promise.resolve({
      error_code: 'ITEM_LOGIN_REQUIRED',
      error_message: 'Item requires user re-authentication'
    });
  }
  
  if (rand < 0.1) {
    return Promise.resolve({
      error_code: 'INSTITUTION_ERROR',
      error_message: 'Temporary institution error'
    });
  }
  
  // Healthy item
  return Promise.resolve({});
}

/**
 * Mark an item as disconnected in the database
 */
async function markItemDisconnected(
  supabase: SupabaseClient, 
  itemId: string, 
  reason: string
): Promise<void> {
  const requestId = `maintenance-disconnect-${Date.now()}`;
  
  // Update the item status
  const { error: updateError } = await supabase
    .from('account_links')
    .update({
      status: 'disconnected',
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId);

  if (updateError) {
    throw new Error(`Failed to update item status: ${updateError.message}`);
  }

  // Insert audit record
  const { error: auditError } = await supabase
    .from('item_status_changes')
    .insert({
      item_id: itemId,
      previous_status: 'active',
      new_status: 'disconnected',
      reason,
      request_id: requestId,
      actor: 'maintenance_scanner',
      created_at: new Date().toISOString()
    });

  // Don't fail if audit insert fails, just log it
  if (auditError) {
    logger.warn({
      event: 'maintenance.audit.failed',
      item_id: itemId,
      error: auditError.message
    }, 'Failed to insert audit record');
  }
}