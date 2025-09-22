# 🚨 URGENT: Fix Authentication Loop Causing DB Crashes

## Problem
Supabase showing 3+ auth events per second causing DB operations to crash.

## Root Cause Analysis
1. **AuthContext** calling both `getUser()` + `onAuthStateChange()` 
2. **Every API route** calling `auth.getUser()` on each request
3. **Frontend SWR** making frequent API calls = frequent auth checks
4. **Middleware** also calling `auth.getUser()` on every protected route

## Immediate Fixes Needed

### 1. Fix AuthContext - Remove Redundant getUser()
```tsx
// src/contexts/AuthContext.tsx
useEffect(() => {
  // REMOVE this - onAuthStateChange will handle initial session
  // const { data, error } = await supabase.auth.getUser();
  
  // Keep only the listener
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
    if (session?.user?.id) {
      void fetchProfile(session.user.id);
    } else {
      setProfile(null);
    }
    setLoading(false);
  });

  return () => subscription.unsubscribe();
}, []);
```

### 2. Cache Authentication in Server Components
Create a cached auth helper to avoid calling `getUser()` on every API request:

```typescript
// src/lib/auth-cache.ts
const authCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

export async function getCachedUser(supabase: any, cacheKey: string) {
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  
  const { data: userData, error } = await supabase.auth.getUser();
  if (!error && userData?.user) {
    authCache.set(cacheKey, {
      user: userData.user,
      timestamp: Date.now()
    });
  }
  
  return error ? null : userData?.user;
}
```

### 3. Reduce SWR Polling
```typescript
// src/hooks/useInfiniteTransactions.ts
const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
  revalidateFirstPage: false,
  revalidateOnFocus: false,        // ADD: Reduce polling
  revalidateOnReconnect: false,    // ADD: Reduce polling
  refreshInterval: 0,              // ADD: Disable auto-refresh
});
```

### 4. Optimize Middleware
```typescript
// src/middleware.ts
export async function middleware(req: NextRequest) {
  // Skip auth check for API routes - let them handle their own auth
  if (req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }
  
  // Only check auth for protected routes
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/private');
  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  
  // Continue with existing logic...
}
```

## Priority Actions
1. **IMMEDIATE**: Fix AuthContext redundant getUser() call
2. **HIGH**: Add SWR polling limits  
3. **HIGH**: Skip middleware auth for API routes
4. **MEDIUM**: Implement auth caching for server routes

## Monitoring
After implementing:
- Monitor Supabase auth events frequency
- Check if DB operations stabilize
- Verify user experience remains smooth