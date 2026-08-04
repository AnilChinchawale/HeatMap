import type { GeopoliticalEvent, ScoredMarket, MarketImpactItem } from './types';

/**
 * Narrative and treemap summary builders for the Gloomberb market-impact engine.
 */

/** Create a short, human-readable summary of the top market impacts for an event. */
export function generateMarketSummary(
  event: GeopoliticalEvent,
  topImpacts: ScoredMarket<unknown>[],
  ruleLabel?: string,
): string {
  if (topImpacts.length === 0) {
    return `${event.title} is being monitored for market impact; no strong correlations detected yet.`;
  }

  const riskItems = topImpacts
    .filter((i) => i.direction === 'risk')
    .slice(0, 3)
    .map((i) => i.data && typeof i.data === 'object' && 'display' in i.data ? (i.data as { display: string }).display : i.symbol);

  const safeHavenItems = topImpacts
    .filter((i) => i.direction === 'opportunity')
    .slice(0, 2)
    .map((i) => i.data && typeof i.data === 'object' && 'display' in i.data ? (i.data as { display: string }).display : i.symbol);

  const context = ruleLabel ? ` via ${ruleLabel}` : '';

  if (riskItems.length === 0) {
    return `${event.title}${context} may benefit ${safeHavenItems.join(', ')} as investors seek safety.`;
  }

  let summary = `${event.title}${context} is pressuring ${riskItems.join(', ')}`;
  if (safeHavenItems.length > 0) {
    summary += ` while supporting safe-haven flows into ${safeHavenItems.join(', ')}.`;
  } else {
    summary += '.';
  }

  return summary;
}

/** Convert scored markets into treemap-ready impact items. */
export function marketImpactItemsFromScores(scoredMarkets: ScoredMarket<unknown>[]): MarketImpactItem[] {
  return scoredMarkets
    .filter((m) => m.impactScore > 0)
    .map((m) => {
      const label = m.data && typeof m.data === 'object' && 'display' in m.data
        ? (m.data as { display: string }).display
        : m.symbol;

      const secondary = m.data && typeof m.data === 'object' && 'change' in m.data
        ? `${(m.data as { change: number | null }).change ?? 0 > 0 ? '+' : ''}${((m.data as { change: number | null }).change ?? 0).toFixed(2)}%`
        : m.data && typeof m.data === 'object' && 'change24h' in m.data
          ? `${(m.data as { change24h: number | null }).change24h ?? 0 > 0 ? '+' : ''}${((m.data as { change24h: number | null }).change24h ?? 0).toFixed(2)}%`
          : undefined;

      return {
        id: `${m.type}:${m.symbol}`,
        label,
        weight: m.impactScore,
        colorValue: m.direction === 'opportunity' ? 1 : m.direction === 'risk' ? -1 : 0,
        primaryText: label,
        secondaryText: secondary,
        data: m,
      };
    });
}
