import { NextResponse } from 'next/server';

import { getUsageStats, clearUsageLogs } from '@/lib/monitoring/api-usage-tracker';

// GET /api/admin/usage-stats
// View API usage statistics (admin only)
export function GET() {
  try {
    const stats = getUsageStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    return NextResponse.json({ error: 'Failed to fetch usage stats' }, { status: 500 });
  }
}

// DELETE /api/admin/usage-stats  
// Clear usage logs (admin only)
export function DELETE() {
  try {
    clearUsageLogs();
    return NextResponse.json({ message: 'Usage logs cleared' });
  } catch (error) {
    console.error('Error clearing usage logs:', error);
    return NextResponse.json({ error: 'Failed to clear usage logs' }, { status: 500 });
  }
}