import type { CompanyQuote } from '@/types/company';

/**
 * Yahoo Finance quote fetcher and cache for the company-exposure engine.
 *
 * Fetches single-symbol chart data via the Yahoo Finance v8 chart endpoint,
 * caches results for 60 seconds, and merges existing quotes from the finance
 * data payload to avoid redundant network calls.
 */

const CACHE_TTL_MS = 60_000;

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        currency?: string;
      };
      indicators?: {
        quote?: Array<{
          close?: (number | null)[];
        }>;
      };
    }>;
  };
}

interface QuoteCacheEntry {
  quotes: Record<string, CompanyQuote>;
  timestamp: number;
}

let quoteCache: QuoteCacheEntry | null = null;

function getYahooBaseUrl(): string {
  const proxy = process.env.YAHOO_FINANCE_PROXY;
  return proxy ? proxy.replace(/\/$/, '') : 'https://query1.finance.yahoo.com';
}

async function fetchYahooChartV8(symbol: string): Promise<CompanyQuote> {
  const baseUrl = getYahooBaseUrl();
  const url = `${baseUrl}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GlobeNewsLive/1.0)' },
    next: { revalidate: 30 },
  } as RequestInit & { next?: { revalidate?: number } });

  if (!res.ok) {
    throw new Error(`Yahoo chart failed for ${symbol}: ${res.status}`);
  }

  const json: YahooChartResult = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) {
    return { symbol, price: null, change: null };
  }

  const meta = result.meta;
  const prices = result.indicators?.quote?.[0]?.close?.filter((v): v is number => v !== null && v !== undefined) ?? [];
  const lastPrice = meta?.regularMarketPrice ?? meta?.previousClose ?? prices[prices.length - 1] ?? null;
  const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? prices[prices.length - 2] ?? lastPrice ?? null;

  let change: number | null = null;
  if (lastPrice !== null && prevClose !== null && prevClose !== 0) {
    change = ((lastPrice - prevClose) / prevClose) * 100;
  }

  return {
    symbol,
    price: lastPrice,
    change,
    currency: meta?.currency || 'USD',
  };
}

function partition<T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  for (const item of arr) {
    if (predicate(item)) pass.push(item);
    else fail.push(item);
  }
  return [pass, fail];
}

/** Fetch live quotes for a list of symbols, reusing the in-memory cache when fresh. */
export async function fetchCompanyQuotes(symbols: string[]): Promise<Record<string, CompanyQuote>> {
  const uniqueSymbols = [...new Set(symbols)].filter(Boolean);
  if (uniqueSymbols.length === 0) return {};

  const now = Date.now();
  let cachedQuotes: Record<string, CompanyQuote> = {};
  const missingSymbols: string[] = [];

  if (quoteCache && now - quoteCache.timestamp < CACHE_TTL_MS) {
    for (const sym of uniqueSymbols) {
      if (quoteCache.quotes[sym]) {
        cachedQuotes[sym] = { ...quoteCache.quotes[sym] };
      } else {
        missingSymbols.push(sym);
      }
    }
  } else {
    missingSymbols.push(...uniqueSymbols);
  }

  if (missingSymbols.length === 0) {
    return cachedQuotes;
  }

  // Yahoo Finance v8 chart is single-symbol; parallelize to minimize wall-clock time.
  const results = await Promise.allSettled(missingSymbols.map((sym) => fetchYahooChartV8(sym)));
  const fetchedQuotes: Record<string, CompanyQuote> = {};

  for (let i = 0; i < missingSymbols.length; i++) {
    const sym = missingSymbols[i];
    const res = results[i];
    if (res.status === 'fulfilled') {
      fetchedQuotes[sym] = res.value;
    } else {
      fetchedQuotes[sym] = { symbol: sym, price: null, change: null };
    }
  }

  const merged = { ...(quoteCache?.quotes ?? {}), ...fetchedQuotes };
  quoteCache = { quotes: merged, timestamp: now };

  return { ...merged, ...cachedQuotes };
}

export function clearCompanyQuoteCache(): void {
  quoteCache = null;
}

/** Fetch quotes for symbols not already present in the provided existing-quote map. */
export async function fetchCompanyQuotesFromExisting(
  symbols: string[],
  existingBySymbol: Record<string, { price?: number | null; change?: number | null; currency?: string }>,
): Promise<Record<string, CompanyQuote>> {
  const [reuseSymbols, fetchSymbols] = partition(
    [...new Set(symbols)].filter(Boolean),
    (sym) => existingBySymbol[sym]?.price !== undefined && existingBySymbol[sym]?.price !== null,
  );

  const reused = Object.fromEntries(
    reuseSymbols.map((sym) => {
      const src = existingBySymbol[sym];
      return [sym, { symbol: sym, price: src.price ?? null, change: src.change ?? null, currency: src.currency }];
    }),
  );

  if (fetchSymbols.length === 0) return reused;

  const fetched = await fetchCompanyQuotes(fetchSymbols);
  return { ...reused, ...fetched };
}
