import type { Signal } from '@/types';
import type { FinanceData, FinanceIndex, FinanceCommodity, FinanceForex, FinanceCrypto } from '@/types/finance';
import type { GeopoliticalEvent, ScoredMarket, TopAffectedMarkets, EventMarketIntelligenceData } from './types';
import type { CompanyQuote } from '@/types/company';
import { EVENT_MAPPING_RULES, findMatchingRules, resolveReasonTemplate } from './event-mapping';
import { generateMarketSummary, marketImpactItemsFromScores } from './summary';
import { CHOKEPOINTS } from '@/lib/supply-chain';
import { buildCompanyExposure } from './company-exposure';
import { buildInfrastructureIntelligence } from './infrastructure-intelligence';

/**
 * Market-impact engine for the Gloomberb integration.
 *
 * Selects the highest-severity geopolitical signal, maps it to affected market
 * symbols, and produces a scored, de-duplicated set of market, company,
 * supply-chain and infrastructure impacts for the finance dashboard.
 */

/** Normalize raw signal severity strings into the canonical `ThreatLevel` enum. */
function toThreatLevel(severity: string | undefined): GeopoliticalEvent['severity'] {
  const s = (severity ?? 'LOW').toUpperCase();
  if (s === 'CRITICAL' || s === 'CRIT') return 'CRITICAL';
  if (s === 'HIGH') return 'HIGH';
  if (s === 'MEDIUM' || s === 'MED') return 'MEDIUM';
  return 'LOW';
}

/** Select the highest-severity, most recent geopolitical event from the signal stream. */
export function selectPrimaryEvent(signals: Signal[]): GeopoliticalEvent | null {
  if (!signals || signals.length === 0) return null;

  const severityRank: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

  const sorted = [...signals].sort((a, b) => {
    const aRank = severityRank[toThreatLevel(a.severity)] ?? 0;
    const bRank = severityRank[toThreatLevel(b.severity)] ?? 0;
    if (bRank !== aRank) return bRank - aRank;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const top = sorted[0];
  if (!top) return null;

  return {
    id: top.id,
    title: top.title,
    severity: toThreatLevel(top.severity),
    category: top.category ?? 'general',
    region: top.region ?? 'global',
    timestamp: typeof top.timestamp === 'string' ? top.timestamp : top.timestamp.toISOString(),
    summary: top.summary,
    lat: top.lat,
    lon: top.lon,
  };
}


function findMatchedSymbols(symbols: string[], targets: string[]): Set<string> {
  const matches = new Set<string>();
  const lowerTargets = targets.map((t) => t.toLowerCase());
  for (const sym of symbols) {
    const lower = sym.toLowerCase();
    if (lowerTargets.includes(lower)) {
      matches.add(sym);
      continue;
    }
    // allow partial match for crypto/forex display names
    for (const target of lowerTargets) {
      if (lower.includes(target) || target.includes(lower)) {
        matches.add(sym);
        break;
      }
    }
  }
  return matches;
}

function scoreMarketCategory<T extends { symbol: string; display: string }>(
  items: T[],
  ruleSymbols: string[] | undefined,
  baseScore: number,
  direction: 'risk' | 'opportunity',
  reason: string,
  type: 'index' | 'commodity' | 'forex' | 'crypto',
): ScoredMarket<T>[] {
  if (!ruleSymbols || ruleSymbols.length === 0) return [];
  const matches = findMatchedSymbols(items.map((i) => i.symbol), ruleSymbols);

  const result: ScoredMarket<T>[] = [];
  for (const item of items) {
    if (!matches.has(item.symbol)) continue;
    result.push({
      symbol: item.symbol,
      type,
      data: item,
      impactScore: baseScore,
      direction,
      reason,
    });
  }
  return result;
}

function scoreChokepoints(
  ruleChokepoints: string[] | undefined,
  baseScore: number,
  direction: 'risk' | 'opportunity',
  reason: string,
): ScoredMarket<{ name: string; risk: string; throughput: string }>[] {
  if (!ruleChokepoints || ruleChokepoints.length === 0) return [];

  return CHOKEPOINTS
    .filter((cp) => ruleChokepoints.some((target) => cp.name.toLowerCase().includes(target.toLowerCase())))
    .map((cp) => ({
      symbol: cp.name,
      type: 'chokepoint' as const,
      data: cp,
      impactScore: cp.risk === 'high' ? Math.min(100, baseScore + 10) : baseScore,
      direction,
      reason,
    }));
}

/** Score every market/asset category against the matching event rules and de-duplicate by symbol. */
export function scoreMarketsForEvent(event: GeopoliticalEvent, financeData: FinanceData): ScoredMarket<unknown>[] {
  const matchingRules = findMatchingRules(event);
  if (matchingRules.length === 0) return [];

  const scored: ScoredMarket<unknown>[] = [];

  for (const { rule, score } of matchingRules) {
    const reason = resolveReasonTemplate(rule, event);

    scored.push(
      ...scoreMarketCategory<FinanceIndex>(financeData.indices, rule.affectedSymbols.indices, score, rule.direction, reason, 'index'),
      ...scoreMarketCategory<FinanceCommodity>(financeData.commodities, rule.affectedSymbols.commodities, score, rule.direction, reason, 'commodity'),
      ...scoreMarketCategory<FinanceForex>(financeData.forex, rule.affectedSymbols.forex, score, rule.direction, reason, 'forex'),
      ...scoreMarketCategory<FinanceCrypto>(financeData.crypto, rule.affectedSymbols.crypto, score, rule.direction, reason, 'crypto'),
      ...scoreChokepoints(rule.affectedSymbols.chokepoints, score, rule.direction, reason),
    );
  }

  // Deduplicate by symbol, keeping highest score
  const bySymbol = new Map<string, ScoredMarket<unknown>>();
  for (const s of scored) {
    const existing = bySymbol.get(s.symbol);
    if (!existing || s.impactScore > existing.impactScore) {
      bySymbol.set(s.symbol, s);
    }
  }

  return Array.from(bySymbol.values()).sort((a, b) => b.impactScore - a.impactScore);
}

function rankTopMarkets<T extends { symbol: string; display: string }>(
  items: T[],
  scoredBySymbol: Map<string, ScoredMarket<unknown>>,
  limit = 4,
): (T & { impactScore: number })[] {
  return items
    .filter((item) => scoredBySymbol.has(item.symbol))
    .map((item) => ({
      ...item,
      impactScore: scoredBySymbol.get(item.symbol)!.impactScore,
    }))
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, limit);
}

/**
 * Build the full event market intelligence payload for the dashboard.
 *
 * The two-pass company scoring avoids fetching live quotes for symbols that are
 * not going to be returned in the top-N list.
 */
export function buildEventMarketIntelligence(
  signals: Signal[],
  financeData: FinanceData,
  companyQuotes: Record<string, CompanyQuote> = {},
): EventMarketIntelligenceData | null {
  const primaryEvent = selectPrimaryEvent(signals);
  if (!primaryEvent) return null;

  const scored = scoreMarketsForEvent(primaryEvent, financeData);
  const { topCompanies, companyImpacts } = buildCompanyExposure(primaryEvent, companyQuotes);
  if (scored.length === 0) {
    return {
      primaryEvent,
      marketSummary: generateMarketSummary(primaryEvent, []),
      impacts: [],
      topMarkets: {
        indices: [],
        commodities: [],
        forex: [],
        crypto: [],
      },
      topCompanies,
      companyImpacts,
      infrastructureIntelligence: buildInfrastructureIntelligence(primaryEvent),
    };
  }

  const scoredBySymbol = new Map<string, ScoredMarket<unknown>>();
  for (const s of scored) scoredBySymbol.set(s.symbol, s);

  const matchingRules = findMatchingRules(primaryEvent);
  const primaryRule = matchingRules[0]?.rule;

  return {
    primaryEvent,
    marketSummary: generateMarketSummary(primaryEvent, scored, primaryRule?.label),
    impacts: marketImpactItemsFromScores(scored),
    topMarkets: {
      indices: rankTopMarkets(financeData.indices, scoredBySymbol, 4),
      commodities: rankTopMarkets(financeData.commodities, scoredBySymbol, 4),
      forex: rankTopMarkets(financeData.forex, scoredBySymbol, 4),
      crypto: rankTopMarkets(financeData.crypto, scoredBySymbol, 4),
    },
    topCompanies,
    companyImpacts,
    infrastructureIntelligence: buildInfrastructureIntelligence(primaryEvent),
  };
}
