import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getPrometheusMetrics, getMetricsJSON } from '@/lib/metrics/collector';

/**
 * Metrics endpoint for Prometheus scraping
 * as outlined in WBS section 7.2.2
 * 
 * GET /api/metrics - Returns Prometheus-formatted metrics
 * GET /api/metrics?format=json - Returns JSON-formatted metrics for debugging
 */

export function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get('format');

    if (format === 'json') {
      // Return JSON format for debugging
      return NextResponse.json({
        ok: true,
        metrics: getMetricsJSON(),
        timestamp: new Date().toISOString(),
        format: 'json',
      });
    }

    // Return Prometheus format by default
    const prometheusMetrics = getPrometheusMetrics();

    return new NextResponse(prometheusMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Failed to generate metrics:', error);
    
    return NextResponse.json({
      ok: false,
      error: 'Failed to generate metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}