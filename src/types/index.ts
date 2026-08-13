export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type SignalCategory = 
  | 'conflict' 
  | 'military' 
  | 'diplomacy' 
  | 'cyber' 
  | 'disaster' 
  | 'economy' 
  | 'politics' 
  | 'terrorism'
  | 'protest'
  | 'infrastructure'
  | 'health';

export interface Signal {
  id: string;
  title: string;
  severity: Severity;
  category: SignalCategory;
  source: string;
  sourceUrl?: string;
  timeAgo: string;
  timestamp: Date;
  lat?: number;
  lon?: number;
  summary?: string;
  region?: string;
  iranRelevance?: number;
}

export interface MarketData {
  name: string;
  symbol: string;
  value: string;
  change: string;
  changePercent: string;
  direction: 'up' | 'down';
}

export interface PredictionMarket {
  id: string;
  question: string;
  probability: number;
  change24h: number;
  volume?: number;
  source: 'Polymarket' | 'Kalshi';
  category: string;
}

export interface ConflictMarker {
  id: string;
  lat: number;
  lon: number;
  name: string;
  type: 'conflict' | 'military' | 'protest' | 'disaster' | 'infrastructure';
  severity: Severity;
  description?: string;
  timestamp: Date;
}

export interface CountryRisk {
  code: string;
  name: string;
  cii: number; // Country Instability Index 0-100
  trend: 'rising' | 'falling' | 'stable';
  activeConflicts: number;
}

export type ThreatLevel = 'LOW' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'SEVERE';

export interface MissileEvent {
  id: string;
  type: 'DRONE' | 'AIRSTRIKE' | 'ARTILLERY' | 'SRBM' | 'CRUISE' | 'MISSILE' | 'ROCKET' | 'INTERCEPTION' | 'ICBM' | 'MRBM' | 'MLRS';
  source: 'ACLED' | 'GDELT' | 'SYNTHETIC';
  origin: [number, number];
  target: [number, number];
  lat: number;
  lon: number;
  timestamp: string;
  location: string;
  label: string;
  description: string;
  severity: Severity;
  region: string;
  speed?: number | string;
  altitude?: number | string;
  warhead?: string;
  status?: 'IN_FLIGHT' | 'IMPACTED' | 'INTERCEPTED' | 'UNKNOWN' | 'intercepted' | 'active';
  targetName?: string;
  country?: string;
  confidence?: number;
  fatalities?: number;
}
