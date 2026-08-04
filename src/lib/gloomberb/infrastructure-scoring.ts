import type { GeopoliticalEvent, ThreatLevel } from './types';
import { findMatchingRules } from './event-mapping';
import { CHOKEPOINTS, MAJOR_PORTS, TRADE_ROUTES } from '@/lib/supply-chain';
import {
  PIPELINES,
  UNDERSEA_CABLES,
  AI_DATA_CENTERS,
  SPACEPORTS,
} from '@/lib/infrastructure';

/**
 * Infrastructure scoring primitives for the Gloomberb integration.
 *
 * Provides 0–100 impact scores for chokepoints, ports, trade routes and generic
 * infrastructure nodes using keyword/region matching, proximity to the event and
 * pre-defined criticality weights.
 */

const SEVERITY_MULTIPLIERS: Record<ThreatLevel, number> = {
  CRITICAL: 1.5,
  HIGH: 1.25,
  MEDIUM: 1.0,
  LOW: 0.75,
};

/** Convert a 0–100 composite score into a human-readable risk level. */
export function riskLevelFromScore(score: number): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (score >= 85) return 'Critical';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}

/** Return the severity multiplier for a given event. */
export function computeSeverityMultiplier(event: GeopoliticalEvent): number {
  return SEVERITY_MULTIPLIERS[event.severity] ?? 1.0;
}

function eventText(event: GeopoliticalEvent): string {
  return `${event.title} ${event.summary ?? ''}`.toLowerCase();
}

function keywordHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) hits += 1;
  }
  return hits;
}

function regionMatches(event: GeopoliticalEvent, region: string): boolean {
  const eventRegion = event.region.toLowerCase();
  const candidate = region.toLowerCase();
  return eventRegion.includes(candidate) || candidate.includes(eventRegion);
}

/** Haversine distance between two lat/lon points, in kilometers. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function proximityScore(event: GeopoliticalEvent, lat: number, lon: number): number {
  if (typeof event.lat !== 'number' || typeof event.lon !== 'number') return 0;
  const km = haversineKm(event.lat, event.lon, lat, lon);
  if (km < 200) return 20;
  if (km < 500) return 15;
  if (km < 1000) return 10;
  if (km < 2000) return 5;
  return 0;
}

function criticalityScoreFromRisk(risk?: string): number {
  const normalized = (risk ?? 'low').toLowerCase();
  if (normalized === 'critical') return 15;
  if (normalized === 'high') return 10;
  if (normalized === 'medium') return 6;
  return 2;
}

function ruleMatchScoreForChokepoints(event: GeopoliticalEvent): number {
  const matched = findMatchingRules(event);
  if (matched.length === 0) return 0;
  const top = matched[0];
  const ruleChokepoints = top.rule.affectedSymbols?.chokepoints ?? [];
  return ruleChokepoints.length > 0 ? Math.round(top.score * 0.4) : 0;
}

/** Score a chokepoint based on keyword/region match, proximity and global criticality. */
export function scoreChokepointRisk(chokepoint: typeof CHOKEPOINTS[number], event: GeopoliticalEvent): number {
  const text = eventText(event);
  let base = 0;

  // Rule match
  const ruleScore = ruleMatchScoreForChokepoints(event);
  if (ruleScore > 0) base += ruleScore;

  // Keyword match
  const nameHits = keywordHits(text, [chokepoint.name, chokepoint.region]);
  base += nameHits * 12;

  // Proximity if event has coordinates
  base += proximityScore(event, chokepoint.lat, chokepoint.lon);

  // Criticality
  base += criticalityScoreFromRisk(chokepoint.risk);

  // Region match
  if (regionMatches(event, chokepoint.region)) base += 8;

  return Math.min(100, Math.round(base * computeSeverityMultiplier(event)));
}

/** Score a port based on keyword/region match, route links to affected chokepoints and throughput. */
export function scorePortRisk(port: typeof MAJOR_PORTS[number], event: GeopoliticalEvent, affectedChokepoints: string[]): number {
  const text = eventText(event);
  let base = 0;

  // Keyword match
  const hits = keywordHits(text, [port.name, port.country, port.region]);
  base += hits * 8;

  // Route connection to affected chokepoints
  const routesThroughPort = TRADE_ROUTES.filter(
    (r) => r.from === port.name || r.to === port.name
  );
  const viaAffected = routesThroughPort.some((r) =>
    r.via.some((v) => affectedChokepoints.some((ac) => ac.toLowerCase() === v.toLowerCase()))
  );
  if (viaAffected) base += 18;

  // Proximity
  base += proximityScore(event, port.lat, port.lon);

  // Region match
  if (regionMatches(event, port.region) || regionMatches(event, port.country)) base += 6;

  // Criticality from throughput (rough heuristic)
  const teuMatch = port.throughput.match(/(\d+)/);
  const teu = teuMatch ? parseInt(teuMatch[1], 10) : 0;
  if (teu >= 30) base += 10;
  else if (teu >= 15) base += 6;
  else if (teu >= 5) base += 3;

  return Math.min(100, Math.round(base * computeSeverityMultiplier(event)));
}

/** Score a trade route based on the highest affected chokepoint along its path. */
export function scoreRouteRisk(
  route: typeof TRADE_ROUTES[number],
  event: GeopoliticalEvent,
  affectedChokepointScores: Map<string, number>
): number {
  let base = 0;
  const text = eventText(event);

  // Score from chokepoints along the route
  let maxCpScore = 0;
  for (const cpName of route.via) {
    const score = affectedChokepointScores.get(cpName.toLowerCase()) ?? 0;
    if (score > maxCpScore) maxCpScore = score;
  }
  base += Math.round(maxCpScore * 0.7);

  // Keyword match on route endpoints
  const hits = keywordHits(text, [route.from, route.to, route.name]);
  base += hits * 6;

  // Severity multiplier
  return Math.min(100, Math.round(base * computeSeverityMultiplier(event)));
}

/** Shape of a generic infrastructure node that can be scored by `scoreInfrastructureNode`. */
export interface ScorableNode {
  id?: string;
  name: string;
  type?: string;
  lat?: number;
  lon?: number;
  country?: string;
  description?: string;
  risk?: string;
}

/** Score a generic infrastructure node (pipeline, cable, data center, spaceport) for an event. */
export function scoreInfrastructureNode(
  node: ScorableNode,
  event: GeopoliticalEvent
): number {
  const text = eventText(event);
  let base = 0;

  // Keyword match
  const keywords = [node.name, node.country ?? '', node.type ?? ''];
  if (node.description) keywords.push(node.description);
  const hits = keywordHits(text, keywords);
  base += hits * 8;

  // Proximity
  if (typeof node.lat === 'number' && typeof node.lon === 'number') {
    base += proximityScore(event, node.lat, node.lon);
  }

  // Region match
  if (node.country && regionMatches(event, node.country)) base += 6;

  // Criticality
  base += criticalityScoreFromRisk(node.risk);

  // Severity
  return Math.min(100, Math.round(base * computeSeverityMultiplier(event)));
}
