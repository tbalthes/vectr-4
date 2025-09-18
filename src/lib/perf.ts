import 'server-only';

/**
 * Performance timing helper to measure and log durations for fetch, map, and bulk upsert phases
 * as outlined in WBS section 1.5.2
 */

interface SpanData {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface PerformanceContext {
  requestId?: string;
  route?: string;
  itemId?: string;
  userId?: string;
}

class PerformanceSpan {
  private spans = new Map<string, SpanData>();
  private context: PerformanceContext;

  constructor(context: PerformanceContext = {}) {
    this.context = context;
  }

  /**
   * Start a named performance span
   */
  start(name: string, metadata?: Record<string, any>): void {
    this.spans.set(name, {
      name,
      startTime: performance.now(),
      metadata
    });
  }

  /**
   * End a named performance span and return duration
   */
  end(name: string, metadata?: Record<string, any>): number {
    const span = this.spans.get(name);
    if (!span) {
      throw new Error(`Performance span '${name}' not found`);
    }

    const endTime = performance.now();
    const duration = endTime - span.startTime;

    span.endTime = endTime;
    span.duration = duration;
    
    if (metadata) {
      span.metadata = { ...span.metadata, ...metadata };
    }

    return duration;
  }

  /**
   * Measure a function execution and return both result and duration
   */
  async measure<T>(
    name: string, 
    fn: () => Promise<T> | T, 
    metadata?: Record<string, any>
  ): Promise<{ result: T; duration: number }> {
    this.start(name, metadata);
    
    try {
      const result = await fn();
      const duration = this.end(name);
      return { result, duration };
    } catch (error) {
      this.end(name, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get all completed spans
   */
  getSpans(): SpanData[] {
    return Array.from(this.spans.values()).filter(span => span.duration !== undefined);
  }

  /**
   * Log performance summary
   */
  logSummary(logger: any, additionalMetadata?: Record<string, any>): void {
    const completedSpans = this.getSpans();
    
    if (completedSpans.length === 0) {
      return;
    }

    const totalDuration = completedSpans.reduce((sum, span) => sum + (span.duration || 0), 0);
    
    const summary = {
      event: 'performance.summary',
      ...this.context,
      totalDuration,
      spans: completedSpans.map(span => ({
        name: span.name,
        duration: span.duration,
        metadata: span.metadata
      })),
      ...additionalMetadata
    };

    logger.info(summary, 'Performance summary');
    
    // Also log individual spans for detailed analysis
    completedSpans.forEach(span => {
      logger.debug({
        event: 'performance.span',
        ...this.context,
        spanName: span.name,
        duration: span.duration,
        metadata: span.metadata
      }, `Performance span: ${span.name}`);
    });
  }

  /**
   * Reset all spans
   */
  reset(): void {
    this.spans.clear();
  }
}

/**
 * Create a new performance context for measuring operations
 */
export function createPerformanceContext(context: PerformanceContext = {}): PerformanceSpan {
  return new PerformanceSpan(context);
}

/**
 * Simple function to measure a single operation
 */
export async function measureOperation<T>(
  name: string,
  fn: () => Promise<T> | T,
  logger?: any,
  context?: PerformanceContext
): Promise<{ result: T; duration: number }> {
  const perf = createPerformanceContext(context);
  const measured = await perf.measure(name, fn);
  
  if (logger) {
    perf.logSummary(logger);
  }
  
  return measured;
}

/**
 * Decorator function to automatically measure async functions
 */
export function measured(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const spanName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - start;
        
        // Log if logger is available in context
        if (this.logger) {
          this.logger.debug({
            event: 'performance.method',
            method: spanName,
            duration
          }, `Method execution: ${spanName}`);
        }
        
        return result;
      } catch (error) {
        const duration = performance.now() - start;
        
        if (this.logger) {
          this.logger.debug({
            event: 'performance.method.error',
            method: spanName,
            duration,
            error: error instanceof Error ? error.message : String(error)
          }, `Method execution failed: ${spanName}`);
        }
        
        throw error;
      }
    };
    
    return descriptor;
  };
}

export type { PerformanceContext, SpanData };