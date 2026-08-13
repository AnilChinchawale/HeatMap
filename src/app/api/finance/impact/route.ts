import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Signal } from "@/types";
import type { FinanceData } from "@/types/finance";
import type { CompanyQuote } from "@/types/company";
import { buildEventMarketIntelligence } from "@/lib/gloomberb/market-impact";
import { fetchCompanyQuotesFromExisting } from "@/lib/gloomberb/company-quotes";

/**
 * API route for event-driven market intelligence.
 *
 * Pulls the latest market data, live company quotes for the scored subset, and
 * returns the full `EventMarketIntelligenceData` payload used by the dashboard
 * overlay and the `/finance` route.
 */

const QUOTE_FETCH_TOP_N = 12;

async function fetchInternal<T>(path: string): Promise<T> {
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3400";
  const protocol = host.includes("localhost") ? "http" : "https";
  const res = await fetch(`${protocol}://${host}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Internal fetch failed: ${path} -> ${res.status}`);
  }
  return res.json() as T;
}

/** Extract already-known company quotes from the finance data payload. */
function buildExistingQuoteMap(financeData: FinanceData): Record<string, { price?: number; change?: number; currency?: string }> {
  const map: Record<string, { price?: number; change?: number; currency?: string }> = {};
  for (const item of financeData.indices) {
    if (item.price !== null && item.price !== undefined) map[item.symbol] = { price: item.price, change: item.change ?? undefined, currency: item.currency ?? undefined };
  }
  for (const item of financeData.commodities) {
    if (item.price !== null && item.price !== undefined) map[item.symbol] = { price: item.price, change: item.change ?? undefined, currency: item.currency ?? undefined };
  }
  for (const item of financeData.forex) {
    if (item.price !== null && item.price !== undefined) map[item.symbol] = { price: item.price, change: item.change ?? undefined, currency: item.currency ?? undefined };
  }
  for (const item of financeData.crypto) {
    if (item.price !== null && item.price !== undefined) map[item.symbol] = { price: item.price, change: item.change24h ?? undefined };
  }
  return map;
}

export async function GET(): Promise<NextResponse> {
  try {
    const [signalsPayload, financeData] = await Promise.all([
      fetchInternal<{ signals: Signal[] }>("/api/signals"),
      fetchInternal<FinanceData>("/api/finance"),
    ]);

    const signals = Array.isArray(signalsPayload.signals) ? signalsPayload.signals : [];

    // First pass: score companies using theme/severity without live quotes to avoid
    // fetching quotes for every catalog symbol.
    const preData = buildEventMarketIntelligence(signals, financeData, {});
    const candidateSymbols = (preData?.topCompanies ?? []).slice(0, QUOTE_FETCH_TOP_N).map((c) => c.symbol);

    // Reuse existing finance data (e.g., indices, commodities, forex, crypto) if any
    // company symbol overlaps, then fetch the rest.
    const existingMap = buildExistingQuoteMap(financeData);
    const companyQuotes: Record<string, CompanyQuote> = await fetchCompanyQuotesFromExisting(candidateSymbols, existingMap);

    // Final pass: score with live quotes.
    const data = buildEventMarketIntelligence(signals, financeData, companyQuotes);

    if (!data) {
      return NextResponse.json(
        { error: "No geopolitical events available to analyze" },
        { status: 503 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/finance/impact] error:", message);
    return NextResponse.json(
      { error: "Failed to generate event market intelligence", details: message },
      { status: 500 }
    );
  }
}
