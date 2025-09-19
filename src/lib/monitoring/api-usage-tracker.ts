/**
 * Simple API usage tracking to monitor for excessive calls
 * In production, this should integrate with your monitoring service
 */

interface ApiCallLog {
  endpoint: string;
  timestamp: number;
  itemId?: string;
  userId?: string;
  duration?: number;
}

// In-memory storage (in production, use Redis or database)
const apiCallLogs: ApiCallLog[] = [];
const MAX_LOG_ENTRIES = 1000; // Keep last 1000 calls

// Thresholds for alerting
const ALERT_THRESHOLDS = {
  callsPerMinute: parseInt(process.env.API_USAGE_CALLS_PER_MINUTE_THRESHOLD || '30', 10),
  callsPerHour: parseInt(process.env.API_USAGE_CALLS_PER_HOUR_THRESHOLD || '200', 10),
  callsPerItem: parseInt(process.env.API_USAGE_CALLS_PER_ITEM_THRESHOLD || '10', 10),
};

export interface UsageStats {
  totalCalls: number;
  callsLastMinute: number;
  callsLastHour: number;
  callsByEndpoint: Record<string, number>;
  callsByItem: Record<string, number>;
  averageDuration: number;
  alerts: string[];
}

export function logApiCall(params: {
  endpoint: string;
  itemId?: string;
  userId?: string;
  duration?: number;
}): void {
  const log: ApiCallLog = {
    ...params,
    timestamp: Date.now(),
  };

  apiCallLogs.push(log);

  // Trim old entries to prevent memory growth
  if (apiCallLogs.length > MAX_LOG_ENTRIES) {
    apiCallLogs.splice(0, apiCallLogs.length - MAX_LOG_ENTRIES);
  }

  // Check for excessive usage patterns
  checkUsageAlerts(log);
}

function checkUsageAlerts(newCall: ApiCallLog): void {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  // Check calls per minute
  const recentCalls = apiCallLogs.filter(call => call.timestamp > oneMinuteAgo);
  if (recentCalls.length > ALERT_THRESHOLDS.callsPerMinute) {
    console.warn(`⚠️ API Usage Alert: ${recentCalls.length} calls in the last minute (threshold: ${ALERT_THRESHOLDS.callsPerMinute})`);
  }

  // Check calls per hour
  const hourlyCalls = apiCallLogs.filter(call => call.timestamp > oneHourAgo);
  if (hourlyCalls.length > ALERT_THRESHOLDS.callsPerHour) {
    console.warn(`⚠️ API Usage Alert: ${hourlyCalls.length} calls in the last hour (threshold: ${ALERT_THRESHOLDS.callsPerHour})`);
  }

  // Check calls per item
  if (newCall.itemId) {
    const itemCalls = recentCalls.filter(call => call.itemId === newCall.itemId);
    if (itemCalls.length > ALERT_THRESHOLDS.callsPerItem) {
      console.warn(`⚠️ API Usage Alert: ${itemCalls.length} calls for item ${newCall.itemId} in the last minute (threshold: ${ALERT_THRESHOLDS.callsPerItem})`);
    }
  }
}

export function getUsageStats(): UsageStats {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  const recentCalls = apiCallLogs.filter(call => call.timestamp > oneMinuteAgo);
  const hourlyCalls = apiCallLogs.filter(call => call.timestamp > oneHourAgo);

  // Group by endpoint
  const callsByEndpoint: Record<string, number> = {};
  for (const call of apiCallLogs) {
    callsByEndpoint[call.endpoint] = (callsByEndpoint[call.endpoint] || 0) + 1;
  }

  // Group by item
  const callsByItem: Record<string, number> = {};
  for (const call of apiCallLogs) {
    if (call.itemId) {
      callsByItem[call.itemId] = (callsByItem[call.itemId] || 0) + 1;
    }
  }

  // Calculate average duration
  const callsWithDuration = apiCallLogs.filter(call => call.duration !== undefined);
  const averageDuration = callsWithDuration.length > 0 
    ? callsWithDuration.reduce((sum, call) => sum + (call.duration || 0), 0) / callsWithDuration.length
    : 0;

  // Generate alerts
  const alerts: string[] = [];
  
  if (recentCalls.length > ALERT_THRESHOLDS.callsPerMinute) {
    alerts.push(`High call volume: ${recentCalls.length} calls in last minute`);
  }
  
  if (hourlyCalls.length > ALERT_THRESHOLDS.callsPerHour) {
    alerts.push(`High call volume: ${hourlyCalls.length} calls in last hour`);
  }

  // Check for items with excessive calls
  for (const [itemId, _count] of Object.entries(callsByItem)) {
    const itemRecentCalls = recentCalls.filter(call => call.itemId === itemId);
    if (itemRecentCalls.length > ALERT_THRESHOLDS.callsPerItem) {
      alerts.push(`Item ${itemId} has ${itemRecentCalls.length} calls in last minute`);
    }
  }

  return {
    totalCalls: apiCallLogs.length,
    callsLastMinute: recentCalls.length,
    callsLastHour: hourlyCalls.length,
    callsByEndpoint,
    callsByItem,
    averageDuration,
    alerts,
  };
}

export function clearUsageLogs(): void {
  apiCallLogs.length = 0;
}