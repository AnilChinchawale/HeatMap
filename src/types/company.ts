export type ExposureLevel = 'High' | 'Medium' | 'Low';
export type CompanyDirection = 'risk' | 'opportunity' | 'neutral';

export interface CompanyQuote {
  symbol: string;
  price: number | null;
  change: number | null; // daily %
  currency?: string;
  cached?: boolean;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  sectorId: string;
  sectorLabel: string;
  exchange?: string;
  tags: string[];
  defaultDirection: CompanyDirection;
}

export interface ExposureSector {
  id: string;
  label: string;
  description?: string;
}

export interface ExposureTheme {
  id: string;
  label: string;
  keywords: string[];
  sectorIds: string[];
}

export interface ScoredCompany {
  symbol: string;
  name: string;
  sector: string; // label
  exchange?: string;
  impactScore: number; // 0-100
  exposureLevel: ExposureLevel;
  direction: CompanyDirection;
  price: number | null;
  change: number | null; // daily %
  tags: string[];
  reason: string;
  themes: string[];
}

export interface CompanyExposureItem {
  id: string;
  label: string;
  weight: number;
  colorValue: number | null;
  primaryText: string;
  secondaryText?: string;
  data: ScoredCompany;
}
