# API Call Optimization & Rate Limiting Fixes

## Overview

This document outlines the fixes implemented to prevent excessive API/database calls in the Plaid integration system. The changes focus on implementing robust safeguards, rate limiting, and monitoring to prevent runaway loops and excessive resource consumption.

## Root Causes Identified

1. **Unbounded Pagination Loops**: The sync logic had `while(true)` loops that could theoretically continue indefinitely
2. **Multiple Webhook Triggers**: Various webhook types were triggering sync operations unnecessarily  
3. **Frontend Rate Limiting**: No controls on user-initiated sync requests
4. **Lack of Circuit Breaker**: No protection against cascading failures
5. **Insufficient Monitoring**: No visibility into API usage patterns

## Fixes Implemented

### 1. Pagination Loop Safeguards (`src/lib/plaid/sync.ts`)

- **Maximum Pages Limit**: Configurable via `PLAID_SYNC_MAX_PAGES` (default: 50)
- **Maximum Duration**: Configurable via `PLAID_SYNC_MAX_DURATION_MS` (default: 5 minutes)
- **Rate Limiting Between Requests**: Configurable via `PLAID_SYNC_RATE_DELAY_MS` (default: 100ms)

```typescript
// Environment variables for configuration
PLAID_SYNC_MAX_PAGES=50
PLAID_SYNC_MAX_DURATION_MS=300000
PLAID_SYNC_RATE_DELAY_MS=100
```

### 2. Circuit Breaker Pattern (`src/app/api/aggregator/plaid/transactions/sync/route.ts`)

- **Failure Threshold**: Configurable via `SYNC_CIRCUIT_BREAKER_FAILURES` (default: 5)
- **Reset Time**: Configurable via `SYNC_CIRCUIT_BREAKER_RESET_MS` (default: 5 minutes)
- **Half-Open Testing**: Automatic recovery testing after reset time

```typescript
// Environment variables for circuit breaker
SYNC_CIRCUIT_BREAKER_FAILURES=5
SYNC_CIRCUIT_BREAKER_RESET_MS=300000
```

### 3. Frontend Rate Limiting (`src/hooks/useAccounts.ts`)

- **Individual Account Sync**: 30-second cooldown per account
- **Bulk Sync Operations**: 60-second cooldown for bulk operations
- **User Feedback**: Clear error messages with remaining cooldown time
- **Failure Recovery**: Rate limits reset on failures to allow retries

### 4. Webhook Trigger Optimization (`src/app/api/aggregator/webhook/route.ts`)

The webhook handler was already optimized to only process `SYNC_UPDATES_AVAILABLE` events. Other webhook types (`INITIAL_UPDATE`, `HISTORICAL_UPDATE`, `DEFAULT_UPDATE`) are logged but skipped to prevent unnecessary API calls.

### 5. API Usage Monitoring (`src/lib/monitoring/api-usage-tracker.ts`)

New monitoring system that tracks:
- Calls per minute/hour
- Calls per item/user
- Average response times
- Automatic alerting for excessive usage

**Thresholds (configurable):**
```typescript
API_USAGE_CALLS_PER_MINUTE_THRESHOLD=30
API_USAGE_CALLS_PER_HOUR_THRESHOLD=200
API_USAGE_CALLS_PER_ITEM_THRESHOLD=10
```

**Admin endpoint:** `GET /api/admin/usage-stats`

## Configuration

### Environment Variables

Add these to your `.env` file to customize the limits:

```bash
# Pagination Safeguards
PLAID_SYNC_MAX_PAGES=50
PLAID_SYNC_MAX_DURATION_MS=300000
PLAID_SYNC_RATE_DELAY_MS=100

# Circuit Breaker
SYNC_CIRCUIT_BREAKER_FAILURES=5
SYNC_CIRCUIT_BREAKER_RESET_MS=300000

# Usage Monitoring  
API_USAGE_CALLS_PER_MINUTE_THRESHOLD=30
API_USAGE_CALLS_PER_HOUR_THRESHOLD=200
API_USAGE_CALLS_PER_ITEM_THRESHOLD=10
```

## Monitoring & Alerting

### Usage Stats API

- **GET** `/api/admin/usage-stats` - View current usage statistics
- **DELETE** `/api/admin/usage-stats` - Clear usage logs

### Console Alerts

The system automatically logs warnings when thresholds are exceeded:

```
⚠️ API Usage Alert: 35 calls in the last minute (threshold: 30)
⚠️ API Usage Alert: Item abc123 has 12 calls in last minute (threshold: 10)
```

### Example Usage Stats Response

```json
{
  "totalCalls": 150,
  "callsLastMinute": 25,
  "callsLastHour": 180,
  "callsByEndpoint": {
    "/api/aggregator/plaid/transactions/sync": 120,
    "/api/aggregator/webhook": 30
  },
  "callsByItem": {
    "item_abc123": 45,
    "item_def456": 32
  },
  "averageDuration": 1250,
  "alerts": [
    "High call volume: 180 calls in last hour"
  ]
}
```

## Testing

The fixes include comprehensive safeguards but maintain backward compatibility. To test:

1. **Normal Operations**: Existing workflows should continue working
2. **Rate Limiting**: Try rapid sync requests - should show cooldown messages
3. **Circuit Breaker**: Simulate failures to test circuit breaker behavior
4. **Usage Monitoring**: Check `/api/admin/usage-stats` for current metrics

## Backward Compatibility

All changes are backward compatible:
- Existing API endpoints continue to work
- Default values ensure normal operations aren't affected
- New safeguards only activate under excessive usage scenarios

## Future Enhancements

Consider implementing:
- Database-backed circuit breaker state (for multi-instance deployments)
- Integration with monitoring services (DataDog, New Relic, etc.)
- User-specific rate limiting
- Automated scaling triggers based on usage patterns
- Webhook retry queue with exponential backoff