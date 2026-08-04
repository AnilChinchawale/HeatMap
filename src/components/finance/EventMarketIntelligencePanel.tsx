'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import type { EventMarketIntelligenceData, ThreatLevel } from '@/lib/gloomberb/types';
import type { PredictionMarket } from '@/types';
import { PanelHeader } from './PanelHeader';
import MarketImpactTreemap from './MarketImpactTreemap';
import AffectedMarketList from './AffectedMarketList';
import CompanyExposureList from './CompanyExposureList';
import InfrastructureRiskSection from './InfrastructureRiskSection';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface PredictionSectionProps {
  predictions: PredictionMarket[];
}

function ProbabilityBar({ probability }: { probability: number }) {
  const isHigh = probability >= 70;
  const isMid = probability >= 40;
  const colorClass = isHigh ? 'text-accent-green' : isMid ? 'text-accent-gold' : 'text-accent-red';
  const bgClass = isHigh ? 'bg-accent-green' : isMid ? 'bg-accent-gold' : 'bg-accent-red';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bgClass}`}
          style={{ width: `${probability}%` }}
        />
      </div>
      <span className={`font-mono text-[10px] font-bold w-8 text-right ${colorClass}`}>
        {probability}%
      </span>
    </div>
  );
}

function PredictionSection({ predictions }: PredictionSectionProps) {
  if (predictions.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[9px] font-mono font-bold tracking-wider text-text-dim">PREDICTION MARKETS</div>
      <div className="space-y-2">
        {predictions.slice(0, 4).map((p) => (
          <div key={p.id} className="p-2 rounded bg-elevated/50 border border-border-subtle">
            <div className="text-[10px] text-white leading-tight mb-1.5">{p.question}</div>
            <ProbabilityBar probability={p.probability} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SeverityBadge({ level }: { level: ThreatLevel }) {
  const colors =
    level === 'CRITICAL'
      ? 'bg-accent-red/20 text-accent-red border-accent-red/30'
      : level === 'HIGH'
        ? 'bg-accent-orange/20 text-accent-orange border-accent-orange/30'
        : level === 'MEDIUM'
          ? 'bg-accent-gold/20 text-accent-gold border-accent-gold/30'
          : 'bg-accent-blue/20 text-accent-blue border-accent-blue/30';

  return <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${colors}`}>{level}</span>;
}

function relevanceScore(eventTitle: string, prediction: PredictionMarket): number {
  const title = eventTitle.toLowerCase();
  const question = prediction.question.toLowerCase();
  let score = 0;
  const words = title.split(/\s+/).filter((w) => w.length > 3);
  for (const word of words) {
    if (question.includes(word)) score += 1;
  }
  if (prediction.category === 'geopolitics') score += 2;
  return score;
}

/**
 * Main event-driven market intelligence overlay for the finance dashboard.
 *
 * Renders top-level event context, affected market categories, company exposure,
 * treemap impact visualization, and infrastructure/supply-chain risk.
 */
export default function EventMarketIntelligencePanel() {
  const { data: impactData, isLoading: impactLoading } = useSWR<EventMarketIntelligenceData>(
    '/api/finance/impact',
    fetcher,
    { refreshInterval: 60000 }
  );
  const { data: predictionsData, isLoading: predictionsLoading } = useSWR<{ predictions: PredictionMarket[] }>(
    '/api/predictions',
    fetcher,
    { refreshInterval: 120000 }
  );

  const event = impactData?.primaryEvent;
  const predictions = predictionsData?.predictions ?? [];

  const filteredPredictions = useMemo(() => {
    if (!event) return predictions.filter((p) => p.category === 'geopolitics');
    const scored = predictions.map((p) => ({ p, score: relevanceScore(event.title, p) }));
    scored.sort((a, b) => b.score - a.score);
    return scored.filter((s) => s.score > 0).map((s) => s.p);
  }, [event, predictions]);

  if (impactLoading) {
    return (
      <div className="glass-panel p-3">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-border-default rounded w-2/3" />
          <div className="h-24 bg-border-default rounded" />
          <div className="h-16 bg-border-default rounded" />
        </div>
      </div>
    );
  }

  if (!impactData) {
    return (
      <div className="glass-panel p-3">
        <div className="text-[10px] text-text-dim">Unable to load event market intelligence.</div>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden">
      <PanelHeader title="EVENT MARKET INTELLIGENCE" live accentColor="cyan" />

      {/* Signal Header */}
      <div className="px-3 py-2 bg-surface/50 border-b border-border-subtle">
        {event && (
          <div className="space-y-1.5">
            <div className="text-[12px] text-white font-semibold leading-tight">{event.title}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge level={event.severity} />
              {event.category && <span className="text-[9px] font-mono text-text-dim uppercase">{event.category}</span>}
              {event.region && <span className="text-[9px] font-mono text-text-dim">{event.region}</span>}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 space-y-4 max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {impactData.marketSummary && (
          <div className="p-2.5 rounded bg-elevated/50 border border-border-subtle">
            <div className="text-[9px] font-mono font-bold tracking-wider text-text-dim mb-1">MARKET SUMMARY</div>
            <div className="text-[10px] text-white/90 leading-relaxed">{impactData.marketSummary}</div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono font-bold tracking-wider text-text-dim">MARKET IMPACT TREEMAP</span>
            <span className="text-[9px] font-mono text-text-dim">Score = impact magnitude</span>
          </div>
          <div className="rounded border border-border-subtle overflow-hidden bg-panel/30" style={{ height: 180 }}>
            <MarketImpactTreemap items={impactData.impacts} height={180} />
          </div>
        </div>

        <div>
          <div className="text-[9px] font-mono font-bold tracking-wider text-text-dim mb-1.5">TOP AFFECTED MARKETS</div>
          <AffectedMarketList
            indices={impactData.topMarkets.indices}
            commodities={impactData.topMarkets.commodities}
            forex={impactData.topMarkets.forex}
            crypto={impactData.topMarkets.crypto}
          />
        </div>

        {impactData.topCompanies.length > 0 && (
          <CompanyExposureList companies={impactData.topCompanies} />
        )}

        {impactData.infrastructureIntelligence && (
          <InfrastructureRiskSection intelligence={impactData.infrastructureIntelligence} />
        )}

        {!predictionsLoading && <PredictionSection predictions={filteredPredictions} />}
      </div>

      <div className="px-3 py-1.5 border-t border-border-subtle bg-panel/30">
        <div className="text-[9px] text-text-dim text-center">Signals + market data + Polymarket • Heuristic scoring</div>
      </div>
    </div>
  );
}
