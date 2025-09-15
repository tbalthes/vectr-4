import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface HistoryMessage {
  type: 'user' | 'ai';
  message: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body;

    // Log the incoming request
    console.log('Received AI chat request');

    if (!genAI) {
      console.error('Gemini client not initialized: missing or invalid GEMINI_API_KEY');
      return NextResponse.json(
        {
          error: 'AI service not available. Please check server configuration.',
          details:
            process.env.NODE_ENV === 'development'
              ? 'GEMINI_API_KEY missing'
              : 'Server configuration error',
        },
        { status: 500 },
      );
    }

    console.log('Request body:', {
      message: message?.substring(0, 100),
      historyLength: history?.length,
    });

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 },
      );
    }

    if (message.length > 32000) {
      return NextResponse.json(
        { error: 'Message too long (max 32,000 characters)' },
        { status: 400 },
      );
    }

    // Try to get the model, fallback if not found
    let model;
    try {
      model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        },
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
          {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Model 'gemini-2.5-flash-lite' not found or not supported. Details: ${errMsg}`);
      return NextResponse.json(
        {
          error:
            "Model 'gemini-2.5-flash-lite' not found or not supported. Please check your Google Generative AI account for available models and update the model name.",
          details: errMsg,
        },
        { status: 500 },
      );
    }

    // Build conversation history for context
    let chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
    if (Array.isArray(history) && history.length > 0) {
      chatHistory = (history.slice(-10) as HistoryMessage[]).map((msg) => ({
        role: msg.type === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }],
      }));
    }

    console.log('Starting chat with history length:', chatHistory.length);
    // Step 1: Ask the model to act as a planner and output a JSON array of required analytics requests.
    // The planner should return JSON like:
    // { "requests": [ { "endpoint": "aggregator", "params": { "range": "30d", "namesOnly": false } }, ... ] }
    const planner = model.startChat({ history: chatHistory });
    const fenceOpen = '```json';
    const fenceClose = '```';
    const plannerPrompt =
      'You are a strict planner. Follow these instructions exactly.\n\n' +
      'Return ONLY a single JSON object and nothing else. Wrap the JSON in a single triple-backtick code fence labeled json, for example:\n\n' +
      fenceOpen +
      '\n{"requests":[ {"endpoint":"aggregator","params":{"range":"90d","namesOnly":false}} ]}\n' +
      fenceClose +
      '\n\nSchema:\n- requests: array of objects\n  - endpoint: string, one of ["aggregator","categories","balances","transactions"]\n  - params: object, allowed keys depend on endpoint (e.g., range, start, end, namesOnly, limit)\n\n' +
      'Important rules:\n1) Do not add any explanatory text, lists, or markdown outside the single code fence.\n2) Use only the endpoints "aggregator", "categories", "balances", or "transactions".\n3) Provide sensible params. When the user asks about affordability, prefer multiple ranges for trend detection (e.g. 90d, 180d, 365d).\n4) If you need category-level breakdowns to answer the question, include a "categories" request with namesOnly=false.\n5) To illustrate recent activity, include a "transactions" request with a small limit (e.g. limit:5).\n\n' +
      `Now, given the user question below, produce the JSON in the exact format above.\nUser question: ${message}`;

    let plannerText = '';
    try {
      const planResult = await planner.sendMessageStream(plannerPrompt);
      for await (const chunk of planResult.stream) {
        const t = chunk.text();
        if (t) {
          plannerText += t;
        }
      }
    } catch {
      console.error('Planner error');
      plannerText = '';
    }

    // Validate planner output using internal schema to prevent arbitrary requests
    const { validatePlannerRequests, checkPlannerQuota, KEY_LABEL_MAP } = await import(
      '@/lib/analytics/validate-planner'
    );

    // Try to extract JSON from the planner output even if the model returns extra text
    function extractJsonLike(input: string) {
      if (!input) {
        return null;
      }
      // Try direct parse first
      try {
        return JSON.parse(input);
      } catch {
        // Heuristic: find first { and last } and attempt to parse substring
        const first = input.indexOf('{');
        const last = input.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          try {
            const sub = input.substring(first, last + 1);
            return JSON.parse(sub);
          } catch {
            // fall through
          }
        }
        // Try code fence extraction
        const fenceMatch = /```(?:json|js|ts)?([\s\S]*?)```/i.exec(input);
        if (fenceMatch?.[1]) {
          try {
            return JSON.parse(fenceMatch[1].trim());
          } catch {
            // fall through
          }
        }
      }
      return null;
    }

    const parsedPlannerObj = extractJsonLike(plannerText) || {};
    if (!plannerText) {
      console.log('Planner returned empty text');
    }
    console.log(
      'Planner raw output (snippet):',
      plannerText ? plannerText.slice(0, 400) : '<empty>',
    );
    let requests = validatePlannerRequests(parsedPlannerObj);
    console.log('Planner parsed requests count:', requests.length, 'requests:', requests);

    // Server-side normalization and expansion:
    // - Normalize planner-provided range tokens to canonical supported values
    // - If planner requested aggregator, automatically add broader supported ranges
    // - Deduplicate requests
    try {
      const hasAggregator = requests.some((r) => r.endpoint === 'aggregator');
      const hasCategories = requests.some((r) => r.endpoint === 'categories');

      // Normalize range tokens
      const RANGE_MAP: Record<string, string> = {
        '180d': '6M',
        '365d': '1Y',
        '1y': '1Y',
        '180': '6M',
        '365': '1Y',
        '6months': '6M',
      };
      for (const r of requests) {
        if (r.endpoint === 'aggregator' && r.params && typeof r.params.range === 'string') {
          const given = String(r.params.range).trim();
          const low = given.toLowerCase();
          if (RANGE_MAP[low]) {
            r.params.range = RANGE_MAP[low];
          }
        }
      }
      if (hasAggregator) {
        // Use canonical supported range tokens for the analytics API
        const existingRanges = new Set(
          requests.filter((r) => r.endpoint === 'aggregator').map((r) => String(r.params?.range)),
        );
        const extraRanges = ['3M', '6M', '1Y'];
        for (const r of extraRanges) {
          if (!existingRanges.has(r)) {
            requests.push({ endpoint: 'aggregator', params: { range: r, namesOnly: false } });
          }
        }
      }
      if (!hasCategories) {
        // Add a categories request for breakdowns if planner didn't request it
        requests.push({ endpoint: 'categories', params: { namesOnly: false } });
      }
      // Deduplicate identical requests (simple stringify-based dedupe)
      const seen = new Set<string>();
      requests = requests.filter((r) => {
        // Ensure params are in canonical form for dedupe
        const paramsCopy = { ...(r.params || {}) } as Record<string, unknown>;
        if (typeof paramsCopy.range === 'string') {
          paramsCopy.range = String(paramsCopy.range).toUpperCase();
        }
        const key = `${r.endpoint}:${JSON.stringify(paramsCopy)}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
      console.log('Expanded planner requests to:', requests);
    } catch (e) {
      console.warn('Failed to expand planner requests:', e);
    }

    // If planner gave no usable requests, retry once with a strict instruction forcing a JSON code fence
    if (requests.length === 0) {
      try {
        console.log(
          'Planner returned no valid requests, retrying with a stricter JSON-only prompt...',
        );
        const fenceOpen = '```json';
        const fenceClose = '```';
        const stricterPrompt =
          plannerPrompt +
          '\nIMPORTANT: Return ONLY a single JSON object wrapped in a triple-backtick code fence with no other text. Example: ' +
          fenceOpen +
          '{"requests":[...] }' +
          fenceClose;
        const retryResult = await planner.sendMessageStream(stricterPrompt);
        let retryText = '';
        for await (const chunk of retryResult.stream) {
          const t = chunk.text();
          if (t) {
            retryText += t;
          }
        }
        const retryParsed = extractJsonLike(retryText) || {};
        requests = validatePlannerRequests(retryParsed);
        console.log('Retry planner parsed requests count:', requests.length, 'requests:', requests);
      } catch (err) {
        console.error('Planner retry failed:', err);
      }
    }

    // Execute requested analytics calls and gather results
    const gatheredData: Record<string, unknown> = {};
    const fetchSummary: {
      label: string;
      endpoint: string;
      params: Record<string, string | boolean>;
      status: 'ok' | 'failed' | 'skipped';
      reason?: string;
    }[] = [];

    const incomingCookies = req.headers?.get?.('cookie') || '';
    const authHeader =
      req.headers?.get?.('authorization') || req.headers?.get?.('x-supabase-access-token') || '';
    const hasAuth = Boolean(incomingCookies) || Boolean(authHeader);
    const quotaKey = incomingCookies || req.headers?.get?.('x-forwarded-for') || 'anonymous';
    const quota = checkPlannerQuota(quotaKey);

    if (!quota.allowed) {
      // If over quota, mark all requested items as skipped
      for (const r of requests) {
        const label = KEY_LABEL_MAP[r.endpoint] || String(r.endpoint).charAt(0).toUpperCase();
        fetchSummary.push({
          label,
          endpoint: r.endpoint,
          params: r.params || {},
          status: 'skipped',
          reason: 'planner_quota_exceeded',
        });
      }
    } else {
      // If no authentication information was forwarded with the AI request, skip server-side analytics
      if (!hasAuth) {
        console.warn(
          'No auth forwarded to /api/ai/chat - skipping analytics fetches to avoid 401s',
        );
        for (const r of requests) {
          const label = KEY_LABEL_MAP[r.endpoint] || String(r.endpoint).charAt(0).toUpperCase();
          fetchSummary.push({
            label,
            endpoint: r.endpoint,
            params: r.params || {},
            status: 'skipped',
            reason: 'no_auth_forwarded',
          });
        }
      } else {
        // Perform analytics fetches while forwarding available auth info
        for (const reqItem of requests) {
          try {
            const label =
              KEY_LABEL_MAP[reqItem.endpoint] || String(reqItem.endpoint).charAt(0).toUpperCase();
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(reqItem.params || {})) {
              params.set(k, String(v));
            }

            // Determine an absolute base URL for server-side fetches. If NEXT_PUBLIC_BASE_URL
            // is not set, derive from request headers to make internal /api calls work.
            const hostHeader =
              req.headers && typeof req.headers.get === 'function' ? req.headers.get('host') : null;
            const protoHeader =
              req.headers && typeof req.headers.get === 'function'
                ? req.headers.get('x-forwarded-proto')
                : null;
            const proto = protoHeader || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
            const host = hostHeader || `localhost:${process.env.PORT || 3000}`;
            const urlBase = process.env.NEXT_PUBLIC_BASE_URL || `${proto}://${host}`;
            console.log('Analytics fetch urlBase:', urlBase, 'params:', params.toString());

            let res: Response | undefined;
            const headers: Record<string, string> = {};
            if (incomingCookies) {
              headers.cookie = incomingCookies;
            }
            if (authHeader) {
              headers.authorization = authHeader;
            }

            if (reqItem.endpoint === 'aggregator') {
              res = await fetch(`${urlBase}/api/analytics/aggregator?${params.toString()}`, {
                headers,
                credentials: 'include' as RequestCredentials,
              });
            } else if (reqItem.endpoint === 'categories') {
              res = await fetch(`${urlBase}/api/analytics/categories?${params.toString()}`, {
                headers,
                credentials: 'include' as RequestCredentials,
              });
            } else {
              fetchSummary.push({
                label,
                endpoint: reqItem.endpoint,
                params: reqItem.params || {},
                status: 'failed',
                reason: 'unsupported_endpoint',
              });
              continue;
            }

            if (!res) {
              fetchSummary.push({
                label,
                endpoint: reqItem.endpoint,
                params: reqItem.params || {},
                status: 'failed',
                reason: 'no_response',
              });
              continue;
            }

            if (!res.ok) {
              const bodyText = await res.text().catch(() => '');
              fetchSummary.push({
                label,
                endpoint: reqItem.endpoint,
                params: reqItem.params || {},
                status: 'failed',
                reason: `http_${res.status}:${bodyText.slice(0, 200)}`,
              });
              continue;
            }

            const json = await res.json().catch((e) => {
              console.error('Failed to parse analytics JSON', e);
              return null;
            });
            gatheredData[`${label}:${params.toString()}`] = json;
            fetchSummary.push({
              label,
              endpoint: reqItem.endpoint,
              params: reqItem.params || {},
              status: 'ok',
            });
          } catch (err) {
            console.error('Error fetching analytics for request', reqItem, err);
            fetchSummary.push({
              label: KEY_LABEL_MAP[reqItem.endpoint] || reqItem.endpoint,
              endpoint: reqItem.endpoint,
              params: reqItem.params || {},
              status: 'failed',
              reason: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }

    // If results look too narrow (e.g., only one month), try fetching broader ranges automatically
    function looksNarrow(value: unknown) {
      if (!value) {
        return true;
      }
      if (Array.isArray(value)) {
        return value.length <= 1;
      }
      if (typeof value === 'object') {
        const v = value as Record<string, unknown>;
        const candidates = ['data', 'results', 'series', 'points', 'values'];
        for (const c of candidates) {
          if (Array.isArray(v[c])) {
            return (v[c] as unknown[]).length <= 1;
          }
        }
        // fallback: check if object has a single top-level key whose value is small
        const keys = Object.keys(v);
        if (keys.length === 1) {
          const single = v[keys[0]];
          if (Array.isArray(single)) {
            return single.length <= 1;
          }
        }
      }
      return false;
    }

    const fallbackRanges = ['90d', '180d', '365d'];
    for (const entry of fetchSummary.filter((f) => f.status === 'ok')) {
      try {
        const labelKey = `${entry.label}:${new URLSearchParams(
          entry.params as Record<string, string>,
        ).toString()}`;
        const current = gatheredData[labelKey];
        if (looksNarrow(current)) {
          // attempt broader ranges
          for (const r of fallbackRanges) {
            try {
              const params = new URLSearchParams();
              for (const [k, v] of Object.entries(entry.params || {})) {
                params.set(k, String(v));
              }
              params.set('range', r);
              const urlBase =
                process.env.NEXT_PUBLIC_BASE_URL ||
                `${req.headers.get?.('x-forwarded-proto') || 'http'}://${
                  req.headers.get?.('host') || `localhost:${process.env.PORT || 3000}`
                }`;
              const url = `${urlBase}/api/analytics/${entry.endpoint}?${params.toString()}`;
              const res = await fetch(url, {
                headers: { cookie: incomingCookies },
                credentials: 'include' as RequestCredentials,
              });
              if (!res.ok) {
                continue;
              }
              const json = await res.json().catch(() => null);
              if (!json) {
                continue;
              }
              // if this new result looks richer, replace
              if (!looksNarrow(json)) {
                gatheredData[`${entry.label}:${params.toString()}`] = json;
                fetchSummary.push({
                  label: entry.label,
                  endpoint: entry.endpoint,
                  params: Object.fromEntries(params.entries()),
                  status: 'ok',
                  reason: `fallback_range_${r}`,
                });
                break; // stop after first successful broader fetch
              }
            } catch {
              // ignore and try next range
            }
          }
        }
      } catch {
        // best-effort
      }
    }

    // Create a concise human-readable summary of the retrieved analytics so the model
    // can easily consume numbers and trends without parsing raw JSON.
    const chat = model.startChat({ history: chatHistory });

    // Helper: compute days between ISO dates (inclusive)
    function daysBetween(startIso: string, endIso: string) {
      try {
        const s = new Date(startIso);
        const e = new Date(endIso);
        const ms = e.getTime() - s.getTime();
        return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
      } catch {
        return 30;
      }
    }

    // Summarize aggregator responses (expected shape: { data: [{income,spending,tx_count,bucket}], metadata: {startDate,endDate} })
    interface AggRow {
      income?: number | string;
      spending?: number | string;
      tx_count?: number | string;
      bucket?: string;
    }
    interface AggResp {
      data?: AggRow[];
      metadata?: { startDate?: string; endDate?: string };
    }
    function summarizeAggregator(obj: unknown) {
      try {
        const o = obj as AggResp | undefined | null;
        const data = o?.data;
        const meta = o?.metadata;
        if (!Array.isArray(data)) {
          return null;
        }
        const totalIncome = data.reduce((s: number, r: AggRow) => s + Number(r.income ?? 0), 0);
        const totalSpending = data.reduce((s: number, r: AggRow) => s + Number(r.spending ?? 0), 0);
        const totalTx = data.reduce((s: number, r: AggRow) => s + Number(r.tx_count ?? 0), 0);
        const start = meta?.startDate ?? data[0]?.bucket ?? null;
        const end = meta?.endDate ?? data[data.length - 1]?.bucket ?? null;
        const days = start && end ? daysBetween(start, end) : data.length;
        const months = Math.max(1, Number((days / 30).toFixed(2)));
        const avgMonthlyIncome = +(totalIncome / months).toFixed(2);
        const avgMonthlySpending = +(totalSpending / months).toFixed(2);
        return {
          totalIncome: +totalIncome.toFixed(2),
          totalSpending: +totalSpending.toFixed(2),
          totalTx,
          start,
          end,
          days,
          avgMonthlyIncome,
          avgMonthlySpending,
        };
      } catch {
        return null;
      }
    }

    // Summarize categories (expected shape: { categories: [...] } or { data: [{category,amount}] })
    function summarizeCategories(obj: unknown) {
      try {
        const o = obj as Record<string, unknown> | null | undefined;
        const arr = (o && (o.categories || o.data)) || null;
        if (!Array.isArray(arr)) {
          return null;
        }
        // Normalize to {name, amount}
        const normalized: { name: string; amount: number }[] = (arr as unknown[])
          .map((c) => {
            const it = c as Record<string, unknown> | null;
            if (!it) {
              return null;
            }
            if (it.category || it.name) {
              return {
                name: String(it.category ?? it.name),
                amount: Number(it.amount ?? it.total ?? it.spending ?? 0),
              };
            }
            if (it.name && it.value) {
              return {
                name: String(typeof it.name === 'string' ? it.name : ''),
                amount: Number(it.value),
              };
            }
            return null;
          })
          .filter(Boolean) as { name: string; amount: number }[];
        normalized.sort((a, b) => b.amount - a.amount);
        const top = normalized
          .slice(0, 5)
          .map((t) => ({ name: t.name, amount: +t.amount.toFixed(2) }));
        return top.length ? top : null;
      } catch {
        return null;
      }
    }

    // Build a readable data summary
    let dataSummary = '';
    try {
      for (const [key, val] of Object.entries(gatheredData)) {
        // key format is like 'A:range=90d' or 'C:namesOnly=false'
        const label = String(key);
        if (!val) {
          dataSummary += `\n- ${label}: no data retrieved.`;
          continue;
        }

        // Try aggregator summary
        const agg = summarizeAggregator(val as unknown);
        if (agg) {
          dataSummary += `\n- ${label} (aggregator): ${agg.start ?? ''} to ${agg.end ?? ''} (${
            agg.days
          } days) — totalIncome=$${agg.totalIncome.toLocaleString()}, totalSpending=$${agg.totalSpending.toLocaleString()}, transactions=${
            agg.totalTx
          }, avgMonthlyIncome=$${agg.avgMonthlyIncome.toLocaleString()}, avgMonthlySpending=$${agg.avgMonthlySpending.toLocaleString()}.`;
          continue;
        }

        // Try categories summary
        const cats = summarizeCategories(val as unknown);
        if (cats) {
          dataSummary += `\n- ${label} (categories): top categories: ${cats
            .map((c) => `${c.name} ($${c.amount.toLocaleString()})`)
            .join(', ')}.`;
          continue;
        }

        // Fallback: include a short JSON snippet
        try {
          dataSummary += `\n- ${label}: ${JSON.stringify(val).slice(0, 200)}...`;
        } catch {
          dataSummary += `\n- ${label}: [unreadable data]`;
        }
      }
    } catch {
      dataSummary += '\n- (failed to summarize fetched data)';
    }

    // Final prompt that instructs the model to use the human-readable summary first
    const contextPrompt = `You are Vectr AI, a sophisticated financial assistant integrated into a personal finance management application. You help users analyze their spending patterns, create budgets, track financial goals, and make informed financial decisions.

Key capabilities:
- Analyze transaction data and spending patterns
- Provide budget recommendations and financial insights
- Help with savings goals and investment planning
- Identify optimization opportunities in spending
- Answer questions about personal finance best practices

Instruction for this response:
1) Use the labeled numeric summaries below ("DATA SUMMARY") when referencing numbers. Do not attempt to re-parse the raw JSON — use the provided aggregates.
2) Compare trends across ranges (e.g., 90d vs 180d vs 365d) and explicitly state whether income/spending are increasing, decreasing, or stable. Compare 90d/180d/365d trends, highlight direction (increasing/decreasing), and use exact numbers from the labeled summary when stating conclusions.
3) When giving a conclusion about affordability, reference exact numbers from the DATA SUMMARY and explain assumptions (loan term, interest rate) used for any payment estimates.
4) If data is missing or marked as skipped, state that clearly and give next steps to obtain the data.

User message: ${message}

Fetched data summary (human-readable): ${dataSummary}

Planner fetch summary: ${JSON.stringify(fetchSummary)}
Planner quota: ${JSON.stringify(quota)}

Retrieved data (raw JSON): ${JSON.stringify(gatheredData)}

Use ONLY the DATA SUMMARY and the retrieved data when asked to reference specific numbers or trends.`;

    console.log('Sending message to Gemini with data context...');

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Emit a small debug line first so the client can see whether analytics were requested/fetched
          const debugLine =
            JSON.stringify({
              debug: {
                requestsCount: requests.length,
                fetchSummary,
                quota,
              },
            }) + '\n';
          controller.enqueue(new TextEncoder().encode(debugLine));

          const result = await chat.sendMessageStream(contextPrompt);

          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              // Send each chunk as a JSON line
              const data = JSON.stringify({ content: text }) + '\n';
              controller.enqueue(new TextEncoder().encode(data));
            }
          }

          // Send final message to indicate completion
          const finalData = JSON.stringify({ done: true }) + '\n';
          controller.enqueue(new TextEncoder().encode(finalData));
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData =
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }) + '\n';
          controller.enqueue(new TextEncoder().encode(errorData));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error: unknown) {
    console.error('Gemini API error:', error);

    // More specific error handling
    let errorMessage = 'Failed to generate AI response';
    let statusCode = 500;

    if (error instanceof Error) {
      // Handle specific Gemini API errors
      if (error.message.includes('API_KEY_INVALID')) {
        errorMessage = 'AI service configuration error';
        statusCode = 503;
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        errorMessage = 'AI service temporarily unavailable due to high demand';
        statusCode = 503;
      } else if (error.message.includes('SAFETY')) {
        errorMessage = 'Content was blocked by safety filters';
        statusCode = 400;
      } else if (error.name === 'AbortError') {
        errorMessage = 'Request cancelled';
        statusCode = 408;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      },
      { status: statusCode },
    );
  }
}
