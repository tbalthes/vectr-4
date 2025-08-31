export type PlannerRequest = {
  endpoint: string;
  params: Record<string, string | boolean>;
};

// Allowed endpoints and their permitted params with expected types
const ENDPOINT_SPECS: Record<
  string,
  Record<string, 'string' | 'boolean'>
> = {
  aggregator: {
    range: 'string',
    start: 'string',
    end: 'string',
    namesOnly: 'boolean',
  },
  categories: {
    namesOnly: 'boolean',
    range: 'string',
  },
};

export function validatePlannerRequests(
  raw: unknown
): PlannerRequest[] {
  if (!raw || typeof raw !== 'object') return [];
  const parsed = raw as Record<string, unknown>;
  if (!Array.isArray(parsed.requests)) return [];

  const out: PlannerRequest[] = [];
  for (const r of parsed.requests) {
    if (!r || typeof r !== 'object') continue;
    const endpoint = String(r.endpoint || '').toLowerCase();
    if (!ENDPOINT_SPECS[endpoint]) continue;
    const spec = ENDPOINT_SPECS[endpoint];
    const paramsIn = r.params && typeof r.params === 'object' ? r.params : {};
    const paramsOut: Record<string, string | boolean> = {};
    for (const [k, v] of Object.entries(paramsIn)) {
      if (!spec[k]) continue; // not allowed param
      const expected = spec[k];
      if (expected === 'boolean') {
        if (typeof v === 'boolean') paramsOut[k] = v;
        else if (typeof v === 'string') {
          const low = v.toLowerCase();
          if (low === 'true' || low === 'false') paramsOut[k] = low === 'true';
        }
      } else if (expected === 'string') {
        if (typeof v === 'string') paramsOut[k] = v;
        else if (typeof v === 'number') paramsOut[k] = String(v);
      }
    }
    out.push({ endpoint, params: paramsOut });
  }
  return out;
}

// Simple in-memory rate limiter per user key (e.g., user id or cookie hash)
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 6; // allow 6 planner calls per minute per user

const rateStore: Map<string, { windowStart: number; count: number }> = new Map();

export function checkPlannerQuota(key: string) {
  const now = Date.now();
  const entry = rateStore.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateStore.set(key, { windowStart: now, count: 1 });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - entry.count };
}

// Mapping for short labels for fetched keys
export const KEY_LABEL_MAP: Record<string, string> = {
  aggregator: 'A',
  categories: 'C',
};
