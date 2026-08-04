import type { FinanceIndex, FinanceCommodity, FinanceCrypto, FinanceForex } from '@/types/finance';
import type { ScoredCompany, CompanyExposureItem } from '@/types/company';

/**
 * Shared domain types for the Gloomberb market-impact and infrastructure engines.
 *
 * The engine consumes geopolitical signals and emits scored market, company,
 * supply-chain and infrastructure artifacts used by the finance dashboard.
 */

export type ThreatLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Normalized geopolitical event selected from the incoming signal stream. */
export interface GeopoliticalEvent {
  id: string;
  title: string;
  severity: ThreatLevel;
  category: string;
  region: string;
  timestamp: string;
  summary?: string;
  lat?: number;
  lon?: number;
}

/** A scored market/asset correlated with a geopolitical event. */
export interface ScoredMarket<T = unknown> {
  symbol: string;
  type: 'index' | 'commodity' | 'forex' | 'crypto' | 'chokepoint';
  data: T;
  impactScore: number; // 0-100
  direction: 'risk' | 'opportunity' | 'neutral';
  reason: string;
}

/** Tile payload for the market-impact treemap. */
export interface MarketImpactItem<T = unknown> {
  id: string;
  label: string;
  weight: number;
  colorValue: number | null;
  primaryText?: string;
  secondaryText?: string;
  data: T;
}

/** Top affected markets, enriched with per-item impact scores. */
export interface TopAffectedMarkets {
  indices: (FinanceIndex & { impactScore: number })[];
  commodities: (FinanceCommodity & { impactScore: number })[];
  forex: (FinanceForex & { impactScore: number })[];
  crypto: (FinanceCrypto & { impactScore: number })[];
}

/**
 * A scored supply-chain or infrastructure node.
 *
 * `symbol` is the unique node identifier/label used as a React key and as a
 * display fallback in compact UI lists.
 */
export interface ScoredInfrastructureNode<T = unknown> {
  symbol: string;
  type: 'chokepoint' | 'port' | 'route' | 'pipeline' | 'cable' | 'dataCenter' | 'spaceport';
  data: T;
  impactScore: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  reason: string;
}

/** A single, human-readable logistics implication derived from scored nodes. */
export interface LogisticsImplication {
  id: string;
  category: 'chokepoint' | 'route' | 'port' | 'pipeline' | 'cable' | 'dataCenter' | 'spaceport' | 'general';
  title: string;
  description: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  impactScore: number;
}

/** Complete supply-chain/infrastructure intelligence for a single event. */
export interface InfrastructureIntelligenceData {
  compositeRisk: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  summary: string;
  chokepoints: ScoredInfrastructureNode[];
  ports: ScoredInfrastructureNode[];
  tradeRoutes: ScoredInfrastructureNode[];
  infrastructureNodes: ScoredInfrastructureNode[];
  logisticsImplications: LogisticsImplication[];
}

/** Top-level payload returned by `/api/finance/impact`. */
export interface EventMarketIntelligenceData {
  primaryEvent: GeopoliticalEvent;
  marketSummary: string;
  impacts: MarketImpactItem[];
  topMarkets: TopAffectedMarkets;
  topCompanies: ScoredCompany[];
  companyImpacts: CompanyExposureItem[];
  infrastructureIntelligence?: InfrastructureIntelligenceData;
}
