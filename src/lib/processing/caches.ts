import 'server-only';

/**
 * Request-scoped caches for accounts, categories, merchants
 * as outlined in WBS section 1.5.1
 * 
 * These caches help avoid per-row DB lookups for cached data during
 * transaction processing and sync operations.
 */

export interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
}

/**
 * Simple in-memory cache with TTL and size limits
 */
class MemoryCache<T> {
  private cache = new Map<string, { value: T; expires: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttlMs = options.ttlMs || 5 * 60 * 1000; // 5 minutes default
  }

  set(key: string, value: T): void {
    // Clean expired entries if cache is getting full
    if (this.cache.size >= this.maxSize) {
      this.cleanup();
    }

    // If still at capacity, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttlMs
    });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; hitRate?: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }
}

// Account cache interfaces
export interface CachedAccount {
  id: string;
  aggregator_account_id: string;
  name: string;
  type: string;
  subtype: string | null;
  institution_name: string | null;
}

// Category cache interfaces  
export interface CachedCategory {
  id: string;
  name: string;
  category_group: string | null;
  parent_category_id: string | null;
}

// Merchant cache interfaces
export interface CachedMerchant {
  id: string;
  name: string;
  name_normalized: string;
  category_id: string | null;
  logo_url: string | null;
}

/**
 * Request-scoped cache collection for processing operations
 */
export class ProcessingCaches {
  public accounts: MemoryCache<CachedAccount>;
  public categories: MemoryCache<CachedCategory>; 
  public merchants: MemoryCache<CachedMerchant>;
  
  private stats = {
    accountHits: 0,
    accountMisses: 0,
    categoryHits: 0,
    categoryMisses: 0,
    merchantHits: 0,
    merchantMisses: 0
  };

  constructor(options: CacheOptions = {}) {
    this.accounts = new MemoryCache<CachedAccount>(options);
    this.categories = new MemoryCache<CachedCategory>(options);
    this.merchants = new MemoryCache<CachedMerchant>(options);
  }

  /**
   * Get account by aggregator account ID with stats tracking
   */
  getAccount(aggregatorAccountId: string): CachedAccount | undefined {
    const result = this.accounts.get(aggregatorAccountId);
    if (result) {
      this.stats.accountHits++;
    } else {
      this.stats.accountMisses++;
    }
    return result;
  }

  /**
   * Cache account by aggregator account ID
   */
  setAccount(aggregatorAccountId: string, account: CachedAccount): void {
    this.accounts.set(aggregatorAccountId, account);
  }

  /**
   * Get category by name with stats tracking
   */
  getCategory(categoryName: string): CachedCategory | undefined {
    const result = this.categories.get(categoryName.toLowerCase());
    if (result) {
      this.stats.categoryHits++;
    } else {
      this.stats.categoryMisses++;
    }
    return result;
  }

  /**
   * Cache category by name
   */
  setCategory(categoryName: string, category: CachedCategory): void {
    this.categories.set(categoryName.toLowerCase(), category);
  }

  /**
   * Get merchant by normalized name with stats tracking
   */
  getMerchant(merchantName: string): CachedMerchant | undefined {
    const normalizedName = normalizeMerchantName(merchantName);
    const result = this.merchants.get(normalizedName);
    if (result) {
      this.stats.merchantHits++;
    } else {
      this.stats.merchantMisses++;
    }
    return result;
  }

  /**
   * Cache merchant by normalized name
   */
  setMerchant(merchantName: string, merchant: CachedMerchant): void {
    const normalizedName = normalizeMerchantName(merchantName);
    this.merchants.set(normalizedName, merchant);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      accounts: this.accounts.getStats(),
      categories: this.categories.getStats(),
      merchants: this.merchants.getStats(),
      totalHits: this.stats.accountHits + this.stats.categoryHits + this.stats.merchantHits,
      totalMisses: this.stats.accountMisses + this.stats.categoryMisses + this.stats.merchantMisses
    };
  }

  /**
   * Reset all caches and statistics
   */
  clear(): void {
    this.accounts.clear();
    this.categories.clear();
    this.merchants.clear();
    
    this.stats = {
      accountHits: 0,
      accountMisses: 0,
      categoryHits: 0,
      categoryMisses: 0,
      merchantHits: 0,
      merchantMisses: 0
    };
  }
}

/**
 * Normalize merchant name for consistent caching
 */
function normalizeMerchantName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .substring(0, 100);      // Limit length
}

/**
 * Create a new processing cache instance for a request
 */
export function createProcessingCaches(options: CacheOptions = {}): ProcessingCaches {
  return new ProcessingCaches(options);
}

// Global cache factory for request-scoped usage
const requestCaches = new WeakMap<object, ProcessingCaches>();

/**
 * Get or create processing caches for a request context
 */
export function getRequestCaches(requestContext: object, options: CacheOptions = {}): ProcessingCaches {
  let caches = requestCaches.get(requestContext);
  if (!caches) {
    caches = createProcessingCaches(options);
    requestCaches.set(requestContext, caches);
  }
  return caches;
}