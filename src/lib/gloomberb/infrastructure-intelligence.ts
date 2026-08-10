import type { GeopoliticalEvent, InfrastructureIntelligenceData, LogisticsImplication, ScoredInfrastructureNode } from './types';
import {
  scoreChokepointRisk,
  scorePortRisk,
  scoreRouteRisk,
  scoreInfrastructureNode,
  riskLevelFromScore,
} from './infrastructure-scoring';
import { CHOKEPOINTS, MAJOR_PORTS, TRADE_ROUTES } from '@/lib/supply-chain';
import {
  PIPELINES,
  UNDERSEA_CABLES,
  AI_DATA_CENTERS,
  SPACEPORTS,
} from '@/lib/infrastructure';

/**
 * Infrastructure intelligence builder for the Gloomberb integration.
 *
 * Converts a geopolitical event into a composite supply-chain risk score and a
 * structured set of affected chokepoints, ports, trade routes, infrastructure
 * nodes and logistics implications for the finance dashboard.
 */

const COMPOSITE_WEIGHTS = {
  chokepoint: 0.35,
  route: 0.25,
  port: 0.2,
  infrastructure: 0.15,
  logistics: 0.05,
};

function maxScore(items: { impactScore: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.impactScore));
}

function buildChokepointNodes(event: GeopoliticalEvent): ScoredInfrastructureNode[] {
  return CHOKEPOINTS.map((cp) => {
    const score = scoreChokepointRisk(cp, event);
    const node: ScoredInfrastructureNode = {
      symbol: cp.name,
      type: 'chokepoint',
      data: cp,
      impactScore: score,
      riskLevel: riskLevelFromScore(score),
      reason: `${cp.name} (${cp.region}) — ${cp.throughput}`,
    };
    return node;
  }).filter((n) => n.impactScore > 0)
    .sort((a, b) => b.impactScore - a.impactScore);
}

function buildPortNodes(event: GeopoliticalEvent, affectedChokepoints: string[]): ScoredInfrastructureNode[] {
  return MAJOR_PORTS.map((port) => {
    const score = scorePortRisk(port, event, affectedChokepoints);
    const node: ScoredInfrastructureNode = {
      symbol: port.name,
      type: 'port',
      data: port,
      impactScore: score,
      riskLevel: riskLevelFromScore(score),
      reason: `${port.name}, ${port.country} — ${port.throughput}`,
    };
    return node;
  }).filter((n) => n.impactScore > 0)
    .sort((a, b) => b.impactScore - a.impactScore);
}

function buildRouteNodes(
  event: GeopoliticalEvent,
  affectedChokepointScores: Map<string, number>
): ScoredInfrastructureNode[] {
  return TRADE_ROUTES.map((route) => {
    const score = scoreRouteRisk(route, event, affectedChokepointScores);
    const node: ScoredInfrastructureNode = {
      symbol: route.name,
      type: 'route',
      data: route,
      impactScore: score,
      riskLevel: riskLevelFromScore(score),
      reason: `${route.from} → ${route.to} via ${route.via.join(', ') || 'direct'}`,
    };
    return node;
  }).filter((n) => n.impactScore > 0)
    .sort((a, b) => b.impactScore - a.impactScore);
}

function buildInfrastructureNodes(event: GeopoliticalEvent): ScoredInfrastructureNode[] {
  const nodes: ScoredInfrastructureNode[] = [];

  for (const p of PIPELINES) {
    const [lat, lon] = p.points[0] ?? [0, 0];
    const country = p.name.split(' ').pop() ?? 'Global';
    const score = scoreInfrastructureNode({ id: p.id, name: p.name, type: 'pipeline', lat, lon, country, risk: p.status === 'sabotaged' ? 'critical' : 'medium' }, event);
    if (score > 0) {
      const node: ScoredInfrastructureNode = {
        symbol: p.id,
        type: 'pipeline',
        data: p,
        impactScore: score,
        riskLevel: riskLevelFromScore(score),
        reason: `${p.name} — ${p.type} pipeline (${p.status})`,
      };
      nodes.push(node);
    }
  }

  for (const c of UNDERSEA_CABLES) {
    const [lat, lon] = c.points[0] ?? [0, 0];
    const score = scoreInfrastructureNode({ id: c.id, name: c.name, type: 'cable', lat, lon, country: c.owners, risk: 'medium' }, event);
    if (score > 0) {
      const node: ScoredInfrastructureNode = {
        symbol: c.id,
        type: 'cable',
        data: c,
        impactScore: score,
        riskLevel: riskLevelFromScore(score),
        reason: `${c.name} — ${c.capacity}`,
      };
      nodes.push(node);
    }
  }

  for (const dc of AI_DATA_CENTERS) {
    const score = scoreInfrastructureNode({ id: dc.id, name: dc.name, type: dc.type, lat: dc.lat, lon: dc.lon, country: dc.country, risk: dc.risk, description: dc.description }, event);
    if (score > 0) {
      const node: ScoredInfrastructureNode = {
        symbol: dc.id,
        type: 'dataCenter',
        data: dc,
        impactScore: score,
        riskLevel: riskLevelFromScore(score),
        reason: `${dc.name} — ${dc.country}`,
      };
      nodes.push(node);
    }
  }

  for (const sp of SPACEPORTS) {
    const score = scoreInfrastructureNode({ id: sp.id, name: sp.name, type: sp.type, lat: sp.lat, lon: sp.lon, country: sp.country, risk: sp.risk, description: sp.description }, event);
    if (score > 0) {
      const node: ScoredInfrastructureNode = {
        symbol: sp.id,
        type: 'spaceport',
        data: sp,
        impactScore: score,
        riskLevel: riskLevelFromScore(score),
        reason: `${sp.name} — ${sp.country}`,
      };
      nodes.push(node);
    }
  }

  return nodes.sort((a, b) => b.impactScore - a.impactScore);
}

function severityScore(severity: 'Low' | 'Medium' | 'High' | 'Critical'): number {
  switch (severity) {
    case 'Critical': return 90;
    case 'High': return 75;
    case 'Medium': return 50;
    case 'Low': return 25;
  }
}

function buildLogisticsImplications(
  event: GeopoliticalEvent,
  chokepoints: ScoredInfrastructureNode[],
  routes: ScoredInfrastructureNode[],
  infrastructureNodes: ScoredInfrastructureNode[]
): LogisticsImplication[] {
  const implications: LogisticsImplication[] = [];
  const text = `${event.title} ${event.summary ?? ''}`.toLowerCase();

  for (const cp of chokepoints.slice(0, 4)) {
    const data = cp.data as { throughput: string; region: string };
    implications.push({
      id: `imp-choke-${cp.symbol}`,
      category: 'chokepoint',
      title: `${cp.symbol} transit risk`,
      description: `${cp.symbol} handles ${data.throughput}; escalation raises corridor risk.`,
      severity: cp.riskLevel,
      impactScore: cp.impactScore,
    });
  }

  for (const route of routes.slice(0, 3)) {
    implications.push({
      id: `imp-route-${route.symbol}`,
      category: 'route',
      title: `${route.symbol} disruption`,
      description: `${route.symbol} may experience delays if chokepoint restrictions widen.`,
      severity: route.riskLevel,
      impactScore: route.impactScore,
    });
  }

  const pipelineNodes = infrastructureNodes.filter((n) => n.type === 'pipeline').slice(0, 2);
  for (const p of pipelineNodes) {
    const data = p.data as { name: string; type: string; status: string };
    implications.push({
      id: `imp-pipe-${p.symbol}`,
      category: 'pipeline',
      title: `${data.name} energy risk`,
      description: `${data.name} (${data.type}) status: ${data.status}.`,
      severity: p.riskLevel,
      impactScore: p.impactScore,
    });
  }

  const cableNodes = infrastructureNodes.filter((n) => n.type === 'cable').slice(0, 2);
  for (const c of cableNodes) {
    const data = c.data as { name: string; capacity: string };
    implications.push({
      id: `imp-cable-${c.symbol}`,
      category: 'cable',
      title: `${data.name} cable risk`,
      description: `${data.name} carries ${data.capacity}; routing redundancy matters.`,
      severity: c.riskLevel,
      impactScore: c.impactScore,
    });
  }

  if (text.includes('taiwan') || text.includes('chip') || text.includes('semiconductor')) {
    const severity = riskLevelFromScore(80);
    implications.push({
      id: 'imp-tech-corridor',
      category: 'route',
      title: 'Semiconductor supply chain',
      description: 'Taiwan Strait and Asia-Pacific routes are critical for advanced-node chip manufacturing.',
      severity,
      impactScore: severityScore(severity),
    });
  }

  if (text.includes('iran') || text.includes('hormuz') || text.includes('middle east')) {
    const severity = riskLevelFromScore(90);
    implications.push({
      id: 'imp-energy-corridor',
      category: 'chokepoint',
      title: 'Global energy corridor',
      description: 'Strait of Hormuz transit risk affects global oil and LNG pricing.',
      severity,
      impactScore: severityScore(severity),
    });
  }

  if (text.includes('red sea') || text.includes('suez') || text.includes('container')) {
    const severity = riskLevelFromScore(75);
    implications.push({
      id: 'imp-freight-corridor',
      category: 'route',
      title: 'Container freight disruption',
      description: 'Red Sea/Suez corridor disruptions extend Asia-Europe transit times and freight costs.',
      severity,
      impactScore: severityScore(severity),
    });
  }

  return implications.slice(0, 6);
}

function buildSummary(
  event: GeopoliticalEvent,
  compositeRisk: number,
  topChokepoint: ScoredInfrastructureNode | undefined,
  topRoute: ScoredInfrastructureNode | undefined
): string {
  const level = riskLevelFromScore(compositeRisk).toLowerCase();
  const cpText = topChokepoint ? ` via ${topChokepoint.symbol}` : '';
  const routeText = topRoute ? `; ${topRoute.symbol} corridor affected` : '';
  return `${event.title} carries ${level} supply-chain risk${cpText}${routeText}.`;
}

/** Build the complete supply-chain/infrastructure intelligence payload for an event. */
export function buildInfrastructureIntelligence(event: GeopoliticalEvent): InfrastructureIntelligenceData {
  const chokepoints = buildChokepointNodes(event);
  const affectedChokepointNames = chokepoints.map((c) => c.symbol);
  const chokepointScoreMap = new Map<string, number>();
  for (const c of chokepoints) {
    chokepointScoreMap.set(c.symbol.toLowerCase(), c.impactScore);
  }

  const ports = buildPortNodes(event, affectedChokepointNames);
  const tradeRoutes = buildRouteNodes(event, chokepointScoreMap);
  const infrastructureNodes = buildInfrastructureNodes(event);
  const logisticsImplications = buildLogisticsImplications(event, chokepoints, tradeRoutes, infrastructureNodes);

  const chokepointScore = maxScore(chokepoints);
  const routeScore = maxScore(tradeRoutes);
  const portScore = maxScore(ports);
  const infraScore = maxScore(infrastructureNodes);
  const logisticsScore = maxScore(logisticsImplications);

  const compositeRisk = Math.min(
    100,
    Math.round(
      chokepointScore * COMPOSITE_WEIGHTS.chokepoint +
      routeScore * COMPOSITE_WEIGHTS.route +
      portScore * COMPOSITE_WEIGHTS.port +
      infraScore * COMPOSITE_WEIGHTS.infrastructure +
      logisticsScore * COMPOSITE_WEIGHTS.logistics
    )
  );

  const summary = buildSummary(
    event,
    compositeRisk,
    chokepoints[0],
    tradeRoutes[0]
  );

  return {
    compositeRisk,
    riskLevel: riskLevelFromScore(compositeRisk),
    summary,
    chokepoints,
    ports,
    tradeRoutes,
    infrastructureNodes,
    logisticsImplications,
  };
}
