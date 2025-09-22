/**
 * Authentication cache to reduce redundant auth.getUser() calls
 * Prevents auth loops by caching user data for short periods
 */

interface CachedUser {
  user: any;
  timestamp: number;
}

const authCache = new Map<string, CachedUser>();
const CACHE_TTL = 30000; // 30 seconds cache

export async function getCachedUser(supabase: any, cacheKey = 'default') {
  const cached = authCache.get(cacheKey);

  // Return cached user if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { user: cached.user, fromCache: true };
  }

  // Fetch fresh user data
  const { data: userData, error } = await supabase.auth.getUser();

  if (!error && userData?.user) {
    // Cache the result
    authCache.set(cacheKey, {
      user: userData.user,
      timestamp: Date.now(),
    });

    return { user: userData.user, fromCache: false };
  }

  // Clear cache on error
  authCache.delete(cacheKey);
  return { user: null, error, fromCache: false };
}

export function clearAuthCache(cacheKey?: string) {
  if (cacheKey) {
    authCache.delete(cacheKey);
  } else {
    authCache.clear();
  }
}

export function getAuthCacheStats() {
  return {
    size: authCache.size,
    keys: Array.from(authCache.keys()),
    oldestEntry: Math.min(...Array.from(authCache.values()).map((v) => v.timestamp)),
  };
}
