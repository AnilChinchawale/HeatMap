import type { GeopoliticalEvent, ThreatLevel } from './types';

/**
 * Event mapping rules connect normalized geopolitical events to affected market
 * symbols, chokepoints and narrative themes. Rules are scored by keyword/region
 * overlap and severity, then consumed by the market-impact and company-exposure
 * engines.
 */

export interface EventMappingRule {
  id: string;
  label: string;
  keywords: string[];
  regions?: string[];
  categories?: string[];
  themes?: string[];
  affectedSymbols: {
    indices?: string[];
    commodities?: string[];
    forex?: string[];
    crypto?: string[];
    chokepoints?: string[];
  };
  baseScore: number; // 0-100
  direction: 'risk' | 'opportunity';
  reasonTemplate: string;
}

const SEVERITY_WEIGHTS: Record<ThreatLevel, number> = {
  CRITICAL: 1.5,
  HIGH: 1.25,
  MEDIUM: 1.0,
  LOW: 0.75,
};

export const EVENT_MAPPING_RULES: EventMappingRule[] = [
  {
    id: 'middle-east-oil',
    label: 'Middle East Oil Supply Risk',
    keywords: ['iran', 'israel', 'hormuz', 'gulf', 'saudi', 'aramco', 'hezbollah', 'hamas', 'gaza', 'lebanon', 'yemen', 'houthi', 'middle east'],
    regions: ['mena', 'israel', 'iran', 'iraq', 'lebanon', 'yemen', 'saudi', 'global'],
    themes: ['middle-east-energy', 'oil-supply', 'strait-transit'],
    affectedSymbols: {
      commodities: ['CL=F', 'BZ=F', 'NG=F', 'GC=F'],
      indices: ['^GDAXI', '^FTSE', '^N225'],
      forex: ['USDCNY=X', 'USDJPY=X', 'EURUSD=X'],
      chokepoints: ['Strait of Hormuz', 'Suez Canal', 'Bab el-Mandeb'],
    },
    baseScore: 85,
    direction: 'risk',
    reasonTemplate: 'Middle East tensions threaten energy supply corridors and safe-haven flows.',
  },
  {
    id: 'red-sea-shipping',
    label: 'Red Sea Shipping Disruption',
    keywords: ['red sea', 'suez', 'houthis', 'shipping', 'container', 'bypass'],
    regions: ['yemen', 'egypt', 'mena', 'global'],
    themes: ['shipping-disruption', 'energy-transport', 'strait-transit'],
    affectedSymbols: {
      commodities: ['BZ=F', 'CL=F', 'GC=F'],
      indices: ['^FTSE', '^GDAXI'],
      chokepoints: ['Suez Canal', 'Bab el-Mandeb', 'Strait of Hormuz'],
    },
    baseScore: 70,
    direction: 'risk',
    reasonTemplate: 'Red Sea shipping disruptions raise freight costs and energy-price uncertainty.',
  },
  {
    id: 'taiwan-china-tech',
    label: 'Taiwan/China Tech Corridor Risk',
    keywords: ['taiwan', 'china', 'semiconductor', 'chip', 'tsmc', 'beijing', 'taipei', 'strait'],
    regions: ['asia', 'taiwan', 'china', 'global'],
    themes: ['semiconductor-supply-chain', 'asia-tech', 'strait-transit'],
    affectedSymbols: {
      indices: ['^HSI', '^N225', '^GSPC', '^IXIC'],
      forex: ['USDCNY=X', 'USDJPY=X', 'TWD=X'],
      crypto: ['BTC', 'ETH', 'SOL'],
      chokepoints: ['Taiwan Strait', 'Strait of Malacca'],
    },
    baseScore: 80,
    direction: 'risk',
    reasonTemplate: 'Asia-Pacific tech-supply-chain risks pressure regional indices and safe-haven currencies.',
  },
  {
    id: 'russia-ukraine-energy',
    label: 'Russia/Ukraine Energy Risk',
    keywords: ['ukraine', 'russia', 'putin', 'nato', 'gas', 'europe', 'sanctions'],
    regions: ['ukraine', 'russia', 'eu', 'europe', 'global'],
    themes: ['european-energy', 'defense', 'oil-supply'],
    affectedSymbols: {
      commodities: ['NG=F', 'BZ=F', 'GC=F', 'ZW=F'],
      indices: ['^GDAXI', '^FTSE', '^FCHI'],
      forex: ['EURUSD=X', 'USDJPY=X', 'USDRUB=X'],
      chokepoints: ['Turkish Straits', 'GIUK Gap'],
    },
    baseScore: 75,
    direction: 'risk',
    reasonTemplate: 'Eurasian conflict and sanctions risk keep energy markets and European indices on edge.',
  },
  {
    id: 'safe-haven-flows',
    label: 'Safe-Haven Demand',
    keywords: ['gold', 'safe haven', 'recession', 'federal reserve', 'fed', 'rate cut', 'rate hike'],
    regions: ['us', 'global'],
    themes: ['safe-haven', 'gold'],
    affectedSymbols: {
      commodities: ['GC=F', 'SI=F'],
      forex: ['USDJPY=X', 'EURUSD=X', 'DXY'],
      indices: ['^GSPC', '^VIX'],
    },
    baseScore: 60,
    direction: 'risk',
    reasonTemplate: 'Macro uncertainty is driving capital toward safe-haven assets and dollar proxies.',
  },
  {
    id: 'cyber-global-risk',
    label: 'Global Cyber Risk',
    keywords: ['cyber', 'apt', 'ransomware', 'hack', 'breach', 'ddos', 'critical infrastructure'],
    regions: ['global', 'us', 'israel', 'iran', 'russia'],
    themes: ['cybersecurity'],
    affectedSymbols: {
      indices: ['^IXIC', '^GSPC', '^DJI'],
      crypto: ['BTC', 'ETH'],
      forex: ['USDJPY=X'],
    },
    baseScore: 55,
    direction: 'risk',
    reasonTemplate: 'Cyber incidents elevate tail-risk pricing across tech-heavy indices and digital assets.',
  },
];

export function eventMatchesRule(event: GeopoliticalEvent, rule: EventMappingRule): boolean {
  const titleText = event.title.toLowerCase();
  const fullText = `${event.title} ${event.summary ?? ''}`.toLowerCase();

  const matchedKeywords = rule.keywords.filter((kw) => fullText.includes(kw.toLowerCase()));
  if (matchedKeywords.length === 0) return false;

  const titleMatches = rule.keywords.filter((kw) => titleText.includes(kw.toLowerCase()));
  const strongMatch = titleMatches.length > 0 || matchedKeywords.length >= 2;

  const regionMatch = !rule.regions || rule.regions.includes(event.region.toLowerCase());
  const categoryMatch = !rule.categories || rule.categories.includes(event.category.toLowerCase());

  return strongMatch || (regionMatch && categoryMatch);
}

/** Compute a 0–100 score for a rule when it matches an event, weighted by severity. */
export function computeRuleScore(event: GeopoliticalEvent, rule: EventMappingRule): number {
  if (!eventMatchesRule(event, rule)) return 0;
  const severityWeight = SEVERITY_WEIGHTS[event.severity] ?? 1.0;
  return Math.min(100, Math.round(rule.baseScore * severityWeight));
}

/** Return the rule's narrative reason template (event-aware templating is reserved for future use). */
export function resolveReasonTemplate(rule: EventMappingRule, event: GeopoliticalEvent): string {
  return rule.reasonTemplate;
}

export interface MappedEventResult {
  rule: EventMappingRule;
  score: number;
}

/** Return all rules that match an event, sorted by descending score. */
export function findMatchingRules(event: GeopoliticalEvent): MappedEventResult[] {
  return EVENT_MAPPING_RULES
    .map((rule) => ({ rule, score: computeRuleScore(event, rule) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
