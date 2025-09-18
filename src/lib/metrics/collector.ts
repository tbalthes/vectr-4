import 'server-only';

/**
 * Metrics collection and Prometheus endpoint setup
 * as outlined in WBS section 7.2.1
 */

interface MetricEntry {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramMetric {
  buckets: HistogramBucket[];
  count: number;
  sum: number;
}

class MetricsCollector {
  private metrics = new Map<string, MetricEntry>();
  private histograms = new Map<string, HistogramMetric>();
  
  // Default histogram buckets for response times (in milliseconds)
  private defaultBuckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  /**
   * Increment a counter metric
   */
  incrementCounter(name: string, labels?: Record<string, string>, increment = 1): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);
    
    this.metrics.set(key, {
      name,
      type: 'counter',
      value: (existing?.value || 0) + increment,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Set a gauge metric value
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    
    this.metrics.set(key, {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Observe a value for a histogram metric
   */
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    let histogram = this.histograms.get(key);
    
    if (!histogram) {
      histogram = {
        buckets: this.defaultBuckets.map(le => ({ le, count: 0 })),
        count: 0,
        sum: 0,
      };
      this.histograms.set(key, histogram);
    }

    // Update histogram buckets
    histogram.buckets.forEach(bucket => {
      if (value <= bucket.le) {
        bucket.count++;
      }
    });

    histogram.count++;
    histogram.sum += value;

    // Store as metric entry for tracking
    this.metrics.set(key, {
      name,
      type: 'histogram',
      value: histogram.count,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    const processedMetrics = new Set<string>();

    for (const [, metric] of this.metrics.entries()) {
      if (processedMetrics.has(metric.name)) {
        continue;
      }
      processedMetrics.add(metric.name);

      // Add help and type comments
      lines.push(`# HELP ${metric.name} Metric collected by vectr-api`);
      lines.push(`# TYPE ${metric.name} ${metric.type}`);

      if (metric.type === 'histogram') {
        // Output histogram buckets
        for (const [histKey, histEntry] of this.metrics.entries()) {
          if (histEntry.name === metric.name) {
            const histogram = this.histograms.get(histKey);
            if (histogram) {
              const labelStr = this.formatLabels(histEntry.labels);
              
              // Bucket metrics
              histogram.buckets.forEach(bucket => {
                const bucketLabels = { ...histEntry.labels, le: bucket.le.toString() };
                lines.push(`${metric.name}_bucket${this.formatLabels(bucketLabels)} ${bucket.count}`);
              });
              
              // +Inf bucket
              const infLabels = { ...histEntry.labels, le: '+Inf' };
              lines.push(`${metric.name}_bucket${this.formatLabels(infLabels)} ${histogram.count}`);
              
              // Count and sum
              lines.push(`${metric.name}_count${labelStr} ${histogram.count}`);
              lines.push(`${metric.name}_sum${labelStr} ${histogram.sum}`);
            }
          }
        }
      } else {
        // Output counter/gauge metrics
        for (const [, metricEntry] of this.metrics.entries()) {
          if (metricEntry.name === metric.name) {
            const labelStr = this.formatLabels(metricEntry.labels);
            lines.push(`${metric.name}${labelStr} ${metricEntry.value}`);
          }
        }
      }
      
      lines.push(''); // Empty line between metric families
    }

    return lines.join('\n');
  }

  /**
   * Get metrics as JSON for debugging
   */
  getMetricsJSON(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, metric] of this.metrics.entries()) {
      result[key] = {
        ...metric,
        histogram: metric.type === 'histogram' ? this.histograms.get(key) : undefined,
      };
    }
    
    return result;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.histograms.clear();
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const sortedLabels = Object.keys(labels)
      .sort()
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
    
    return `${name}{${sortedLabels}}`;
  }

  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }
    
    const labelPairs = Object.keys(labels)
      .sort()
      .map(key => `${key}="${labels[key]}"`)
      .join(',');
    
    return `{${labelPairs}}`;
  }
}

// Global metrics collector instance
const metrics = new MetricsCollector();

// API metrics helpers
export function recordAPIRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number
): void {
  metrics.incrementCounter('api_requests_total', {
    method,
    route,
    status: statusCode.toString(),
  });

  metrics.observeHistogram('api_request_duration_ms', duration, {
    method,
    route,
  });
}

export function recordWebhookReceived(provider: string, eventType: string): void {
  metrics.incrementCounter('webhooks_received_total', {
    provider,
    event_type: eventType,
  });
}

export function recordSyncOperation(
  provider: string,
  operation: string,
  success: boolean,
  duration: number
): void {
  metrics.incrementCounter('sync_operations_total', {
    provider,
    operation,
    success: success.toString(),
  });

  metrics.observeHistogram('sync_operation_duration_ms', duration, {
    provider,
    operation,
  });
}

export function recordCacheOperation(operation: 'hit' | 'miss', type: string): void {
  metrics.incrementCounter('cache_operations_total', {
    operation,
    type,
  });
}

export function recordDatabaseOperation(
  table: string,
  operation: string,
  duration: number
): void {
  metrics.incrementCounter('db_operations_total', {
    table,
    operation,
  });

  metrics.observeHistogram('db_operation_duration_ms', duration, {
    table,
    operation,
  });
}

export function setActiveConnections(count: number): void {
  metrics.setGauge('active_connections', count);
}

export function setQueueSize(queue: string, size: number): void {
  metrics.setGauge('queue_size', size, { queue });
}

// Export the metrics collector and formatted output
export { metrics };
export const getPrometheusMetrics = () => metrics.getPrometheusMetrics();
export const getMetricsJSON = () => metrics.getMetricsJSON();
export const resetMetrics = () => metrics.reset();