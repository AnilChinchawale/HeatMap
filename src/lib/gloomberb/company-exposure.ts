import type { GeopoliticalEvent, ThreatLevel } from './types';
import type {
  CompanyDirection,
  CompanyProfile,
  CompanyQuote,
  ExposureLevel,
  ExposureSector,
  ExposureTheme,
  ScoredCompany,
  CompanyExposureItem,
} from '@/types/company';
import { findMatchingRules, computeRuleScore } from './event-mapping';

/**
 * Company exposure engine for the Gloomberb integration.
 *
 * Scores a static catalog of companies by matching geopolitical event themes to
 * company tags and sector labels, then optionally amplifies the score using live
 * quote changes. Returns a top-N list of scored companies and treemap-ready
 * exposure items.
 */

const SEVERITY_WEIGHTS: Record<ThreatLevel, number> = {
  CRITICAL: 1.0,
  HIGH: 0.85,
  MEDIUM: 0.7,
  LOW: 0.55,
};


export const EXPOSURE_SECTORS: Record<string, ExposureSector> = {
  oil_majors: { id: 'oil_majors', label: 'Oil Majors', description: 'Integrated oil & gas producers with upstream exposure' },
  integrated_oil: { id: 'integrated_oil', label: 'Integrated Oil', description: 'Large-cap oil & gas conglomerates' },
  shipping: { id: 'shipping', label: 'Container Shipping', description: 'Container lines and marine logistics' },
  semiconductors: { id: 'semiconductors', label: 'Semiconductors', description: 'Chip designers, foundries and equipment makers' },
  defense: { id: 'defense', label: 'Defense', description: 'Aerospace & defense contractors' },
  gold_mining: { id: 'gold_mining', label: 'Gold Mining', description: 'Gold producers and royalty companies' },
  cyber_security: { id: 'cyber_security', label: 'Cybersecurity', description: 'IT security software and services vendors' },
};

export const EXPOSURE_THEMES: ExposureTheme[] = [
  {
    id: 'middle-east-energy',
    label: 'Middle East Energy Disruption',
    keywords: ['iran', 'israel', 'hormuz', 'gulf', 'saudi', 'aramco', 'hezbollah', 'hamas', 'gaza', 'lebanon', 'yemen', 'houthi', 'middle east'],
    sectorIds: ['oil_majors', 'integrated_oil', 'shipping'],
  },
  {
    id: 'oil-supply',
    label: 'Global Oil Supply Risk',
    keywords: ['oil', 'opec', 'crude', 'brent', 'wti', 'petroleum', 'gasoline'],
    sectorIds: ['oil_majors', 'integrated_oil'],
  },
  {
    id: 'strait-transit',
    label: 'Strait / Chokepoint Transit Risk',
    keywords: ['strait', 'chokepoint', 'hormuz', 'malacca', 'suez', 'bab el-mandeb', 'transit'],
    sectorIds: ['shipping', 'oil_majors', 'integrated_oil'],
  },
  {
    id: 'shipping-disruption',
    label: 'Maritime Shipping Disruption',
    keywords: ['red sea', 'suez', 'shipping', 'container', 'freight', 'bypass', 'vessel'],
    sectorIds: ['shipping', 'oil_majors'],
  },
  {
    id: 'energy-transport',
    label: 'Energy Transport Disruption',
    keywords: ['pipeline', 'tanker', 'shipping', 'energy transport', 'lng'],
    sectorIds: ['shipping', 'oil_majors', 'integrated_oil'],
  },
  {
    id: 'semiconductor-supply-chain',
    label: 'Semiconductor Supply Chain Risk',
    keywords: ['semiconductor', 'chip', 'tsmc', 'foundry', 'wafer', 'advanced node'],
    sectorIds: ['semiconductors'],
  },
  {
    id: 'asia-tech',
    label: 'Asia-Pacific Tech Corridor Risk',
    keywords: ['taiwan', 'china', 'beijing', 'taipei', 'tech', 'electronics'],
    sectorIds: ['semiconductors'],
  },
  {
    id: 'european-energy',
    label: 'European Energy Security',
    keywords: ['ukraine', 'russia', 'gas', 'europe', 'nato', 'sanctions', 'lng'],
    sectorIds: ['oil_majors', 'integrated_oil', 'defense'],
  },
  {
    id: 'defense',
    label: 'Defense Spending',
    keywords: ['nato', 'defense', 'military', 'weapons', 'ukraine', 'taiwan', 'conflict'],
    sectorIds: ['defense'],
  },
  {
    id: 'safe-haven',
    label: 'Safe-Haven Demand',
    keywords: ['safe haven', 'gold', 'recession', 'federal reserve', 'rate cut', 'rate hike'],
    sectorIds: ['gold_mining'],
  },
  {
    id: 'gold',
    label: 'Gold Demand',
    keywords: ['gold', 'inflation', 'dollar', 'safe haven'],
    sectorIds: ['gold_mining'],
  },
  {
    id: 'cybersecurity',
    label: 'Cybersecurity Incidents',
    keywords: ['cyber', 'apt', 'ransomware', 'hack', 'breach', 'ddos', 'critical infrastructure'],
    sectorIds: ['cyber_security'],
  },
];

export const COMPANY_CATALOG: CompanyProfile[] = [
  // Oil majors / integrated oil
  { symbol: 'CVX', name: 'Chevron', sectorId: 'oil_majors', sectorLabel: 'Oil Majors', exchange: 'NYSE', tags: ['oil production', 'middle east upstream', 'strait transit'], defaultDirection: 'risk' },
  { symbol: 'XOM', name: 'ExxonMobil', sectorId: 'oil_majors', sectorLabel: 'Oil Majors', exchange: 'NYSE', tags: ['oil production', 'integrated', ' lng'], defaultDirection: 'risk' },
  { symbol: 'SHEL', name: 'Shell', sectorId: 'integrated_oil', sectorLabel: 'Integrated Oil', exchange: 'LSE', tags: ['integrated oil', 'lng', 'shipping'], defaultDirection: 'risk' },
  { symbol: 'TTE', name: 'TotalEnergies', sectorId: 'integrated_oil', sectorLabel: 'Integrated Oil', exchange: 'EPA', tags: ['integrated oil', 'lng', 'middle east'], defaultDirection: 'risk' },
  { symbol: 'COP', name: 'ConocoPhillips', sectorId: 'oil_majors', sectorLabel: 'Oil Majors', exchange: 'NYSE', tags: ['oil production', 'shale', 'global upstream'], defaultDirection: 'risk' },
  { symbol: 'OXY', name: 'Occidental Petroleum', sectorId: 'oil_majors', sectorLabel: 'Oil Majors', exchange: 'NYSE', tags: ['oil production', 'permian', 'chemicals'], defaultDirection: 'risk' },
  { symbol: 'BP', name: 'BP', sectorId: 'integrated_oil', sectorLabel: 'Integrated Oil', exchange: 'LSE', tags: ['integrated oil', 'renewables', 'middle east'], defaultDirection: 'risk' },

  // Shipping
  { symbol: 'MAERSK-B.CO', name: 'A.P. Moller-Maersk', sectorId: 'shipping', sectorLabel: 'Container Shipping', exchange: 'CPH', tags: ['container shipping', 'red sea', 'suez'], defaultDirection: 'risk' },
  { symbol: 'HLAG.DE', name: 'Hapag-Lloyd', sectorId: 'shipping', sectorLabel: 'Container Shipping', exchange: 'XETRA', tags: ['container shipping', 'red sea', 'suez'], defaultDirection: 'risk' },
  { symbol: 'ZIM', name: 'ZIM Integrated Shipping', sectorId: 'shipping', sectorLabel: 'Container Shipping', exchange: 'NYSE', tags: ['container shipping', 'red sea', 'asia'], defaultDirection: 'risk' },

  // Semiconductors
  { symbol: 'TSM', name: 'TSMC', sectorId: 'semiconductors', sectorLabel: 'Semiconductors', exchange: 'NYSE', tags: ['foundry', 'advanced nodes', 'taiwan'], defaultDirection: 'risk' },
  { symbol: 'NVDA', name: 'NVIDIA', sectorId: 'semiconductors', sectorLabel: 'Semiconductors', exchange: 'NASDAQ', tags: ['gpu', 'ai chips', 'data center'], defaultDirection: 'risk' },
  { symbol: 'ASML', name: 'ASML', sectorId: 'semiconductors', sectorLabel: 'Semiconductors', exchange: 'NASDAQ', tags: ['lithography', 'euv', 'equipment'], defaultDirection: 'risk' },
  { symbol: 'AMD', name: 'AMD', sectorId: 'semiconductors', sectorLabel: 'Semiconductors', exchange: 'NASDAQ', tags: ['cpu', 'gpu', 'data center'], defaultDirection: 'risk' },
  { symbol: 'QCOM', name: 'Qualcomm', sectorId: 'semiconductors', sectorLabel: 'Semiconductors', exchange: 'NASDAQ', tags: ['mobile chips', '5g', 'licensing'], defaultDirection: 'risk' },
  { symbol: 'AVGO', name: 'Broadcom', sectorId: 'semiconductors', sectorLabel: 'Semiconductors', exchange: 'NASDAQ', tags: ['chips', 'software', 'data center'], defaultDirection: 'risk' },
  { symbol: 'INTC', name: 'Intel', sectorId: 'semiconductors', sectorLabel: 'Semiconductors', exchange: 'NASDAQ', tags: ['cpu', 'foundry', 'us manufacturing'], defaultDirection: 'risk' },

  // Defense
  { symbol: 'LMT', name: 'Lockheed Martin', sectorId: 'defense', sectorLabel: 'Defense', exchange: 'NYSE', tags: ['defense contractor', 'aerospace', 'nato'], defaultDirection: 'opportunity' },
  { symbol: 'NOC', name: 'Northrop Grumman', sectorId: 'defense', sectorLabel: 'Defense', exchange: 'NYSE', tags: ['defense contractor', 'aerospace', 'nato'], defaultDirection: 'opportunity' },
  { symbol: 'GD', name: 'General Dynamics', sectorId: 'defense', sectorLabel: 'Defense', exchange: 'NYSE', tags: ['defense contractor', 'land systems', 'nato'], defaultDirection: 'opportunity' },
  { symbol: 'BA', name: 'Boeing', sectorId: 'defense', sectorLabel: 'Defense', exchange: 'NYSE', tags: ['defense', 'aerospace', 'nato'], defaultDirection: 'opportunity' },
  { symbol: 'RHM.DE', name: 'Rheinmetall', sectorId: 'defense', sectorLabel: 'Defense', exchange: 'XETRA', tags: ['defense contractor', 'land systems', 'europe'], defaultDirection: 'opportunity' },
  { symbol: 'SAAB-B.ST', name: 'Saab', sectorId: 'defense', sectorLabel: 'Defense', exchange: 'STO', tags: ['defense contractor', 'europe', 'nato'], defaultDirection: 'opportunity' },

  // Gold mining
  { symbol: 'NEM', name: 'Newmont', sectorId: 'gold_mining', sectorLabel: 'Gold Mining', exchange: 'NYSE', tags: ['gold mining', 'safe haven', 'global'], defaultDirection: 'opportunity' },
  { symbol: 'GOLD', name: 'Barrick Gold', sectorId: 'gold_mining', sectorLabel: 'Gold Mining', exchange: 'NYSE', tags: ['gold mining', 'safe haven', 'copper'], defaultDirection: 'opportunity' },

  // Cybersecurity
  { symbol: 'CRWD', name: 'CrowdStrike', sectorId: 'cyber_security', sectorLabel: 'Cybersecurity', exchange: 'NASDAQ', tags: ['endpoint security', 'threat intel'], defaultDirection: 'opportunity' },
  { symbol: 'PANW', name: 'Palo Alto Networks', sectorId: 'cyber_security', sectorLabel: 'Cybersecurity', exchange: 'NASDAQ', tags: ['network security', 'cloud security'], defaultDirection: 'opportunity' },
  { symbol: 'FTNT', name: 'Fortinet', sectorId: 'cyber_security', sectorLabel: 'Cybersecurity', exchange: 'NASDAQ', tags: ['network security', 'firewall'], defaultDirection: 'opportunity' },
  { symbol: 'ZS', name: 'Zscaler', sectorId: 'cyber_security', sectorLabel: 'Cybersecurity', exchange: 'NASDAQ', tags: ['cloud security', 'zero trust'], defaultDirection: 'opportunity' },
];

function eventText(event: GeopoliticalEvent): string {
  return `${event.title} ${event.summary ?? ''}`.toLowerCase();
}

function scoreThemeMatch(event: GeopoliticalEvent, theme: ExposureTheme): number {
  const text = eventText(event);
  const matches = theme.keywords.filter((kw) => text.includes(kw.toLowerCase()));
  return matches.length;
}

function exposureLevel(score: number): ExposureLevel {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

function priceAmplifier(change: number | null): number {
  if (change === null || !Number.isFinite(change)) return 0;
  return Math.min(10, Math.abs(change) * 1.2);
}

function buildReason(
  company: CompanyProfile,
  themeLabels: string[],
  exposureLevelValue: ExposureLevel,
  change: number | null,
): string {
  const themePhrase = themeLabels.length > 0 ? themeLabels.join(', ') : 'the current event';
  const tagsPhrase = company.tags.slice(0, 2).join(', ');
  const exposurePhrase = `${exposureLevelValue} exposure`;

  let movePhrase = '';
  if (change !== null && Number.isFinite(change)) {
    const direction = change > 0 ? 'up' : 'down';
    movePhrase = ` Daily move is ${change >= 0 ? '+' : ''}${change.toFixed(2)}%.`;
  } else {
    movePhrase = ' Price data temporarily unavailable.';
  }

  return `${company.name} (${company.sectorLabel}) has ${exposurePhrase} to ${themePhrase} through ${tagsPhrase}.${movePhrase}`;
}

export interface CompanyExposureResult {
  topCompanies: ScoredCompany[];
  companyImpacts: CompanyExposureItem[];
}

/** Build scored company exposure and treemap-ready exposure items for an event. */
export function buildCompanyExposure(
  event: GeopoliticalEvent,
  quotes: Record<string, CompanyQuote>,
): CompanyExposureResult {
  const matchedRules = findMatchingRules(event);
  if (matchedRules.length === 0) {
    return { topCompanies: [], companyImpacts: [] };
  }

  const matchedThemeIds = new Set<string>();
  const ruleScoreByTheme = new Map<string, number>();

  for (const { rule, score } of matchedRules) {
    if (!rule.themes) continue;
    for (const themeId of rule.themes) {
      if (!matchedThemeIds.has(themeId) || (ruleScoreByTheme.get(themeId) ?? 0) < score) {
        ruleScoreByTheme.set(themeId, score);
      }
      matchedThemeIds.add(themeId);
    }
  }

  const activeThemes = EXPOSURE_THEMES.filter((t) => matchedThemeIds.has(t.id));
  if (activeThemes.length === 0) {
    return { topCompanies: [], companyImpacts: [] };
  }

  const activeSectorIds = new Set<string>();
  for (const theme of activeThemes) {
    for (const sectorId of theme.sectorIds) {
      activeSectorIds.add(sectorId);
    }
  }

  const severityWeight = SEVERITY_WEIGHTS[event.severity] ?? 1.0;
  const eventTextValue = eventText(event);

  const scored: ScoredCompany[] = [];

  for (const company of COMPANY_CATALOG) {
    if (!activeSectorIds.has(company.sectorId)) continue;

    let bestBaseScore = 0;
    let matchedThemeLabels: string[] = [];
    let tagMatches = 0;

    for (const theme of activeThemes) {
      if (!theme.sectorIds.includes(company.sectorId)) continue;

      const ruleScore = ruleScoreByTheme.get(theme.id) ?? 50;
      const themeBaseScore = Math.round(ruleScore * 0.6 * severityWeight);
      const keywordMatches = scoreThemeMatch(event, theme);
      const currentTagMatches = company.tags.filter((tag) => eventTextValue.includes(tag.toLowerCase())).length;

      const base = themeBaseScore + keywordMatches * 2 + currentTagMatches * 3;
      if (base > bestBaseScore) {
        bestBaseScore = base;
      }
      if (keywordMatches > 0) {
        matchedThemeLabels.push(theme.label);
      }
      tagMatches = Math.max(tagMatches, currentTagMatches);
    }

    if (bestBaseScore === 0) continue;

    const quote = quotes[company.symbol] ?? { price: null, change: null };
    const adjustedScore = Math.min(100, Math.round(bestBaseScore + priceAmplifier(quote.change)));
    const level = exposureLevel(adjustedScore);
    const direction = company.defaultDirection;

    scored.push({
      symbol: company.symbol,
      name: company.name,
      sector: company.sectorLabel,
      exchange: company.exchange,
      impactScore: adjustedScore,
      exposureLevel: level,
      direction,
      price: quote.price ?? null,
      change: quote.change ?? null,
      tags: company.tags,
      reason: buildReason(company, matchedThemeLabels, level, quote.change),
      themes: matchedThemeLabels,
    });
  }

  scored.sort((a, b) => {
    if (b.impactScore !== a.impactScore) return b.impactScore - a.impactScore;
    const bTagCount = b.tags.length;
    const aTagCount = a.tags.length;
    if (bTagCount !== aTagCount) return bTagCount - aTagCount;
    const bAbsChange = b.change !== null ? Math.abs(b.change) : 0;
    const aAbsChange = a.change !== null ? Math.abs(a.change) : 0;
    if (bAbsChange !== aAbsChange) return bAbsChange - aAbsChange;
    return a.symbol.localeCompare(b.symbol);
  });

  const topCompanies = scored.slice(0, 10);
  const companyImpacts: CompanyExposureItem[] = topCompanies.map((c) => ({
    id: `company:${c.symbol}`,
    label: c.name,
    weight: c.impactScore,
    colorValue: c.direction === 'opportunity' ? 1 : c.direction === 'risk' ? -1 : 0,
    primaryText: c.name,
    secondaryText: c.change !== null ? `${c.change >= 0 ? '+' : ''}${c.change.toFixed(2)}%` : undefined,
    data: c,
  }));

  return { topCompanies, companyImpacts };
}

/** Return the unique set of symbols in the company catalog. */
export function getAllCompanySymbols(): string[] {
  return [...new Set(COMPANY_CATALOG.map((c) => c.symbol))];
}
