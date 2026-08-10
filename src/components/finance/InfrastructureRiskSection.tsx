import type { InfrastructureIntelligenceData, ScoredInfrastructureNode } from '@/lib/gloomberb/types';

/**
 * Renders the "Infrastructure & Supply Chain Risk" section inside the
 * `EventMarketIntelligencePanel`. Summarizes composite risk, chokepoints, trade
 * routes, critical infrastructure nodes and logistics implications.
 */
interface InfrastructureRiskSectionProps {
  intelligence: InfrastructureIntelligenceData;
}

function RiskBadge({ level }: { level: 'Low' | 'Medium' | 'High' | 'Critical' }) {
  const colors =
    level === 'Critical'
      ? 'bg-accent-red/20 text-accent-red border-accent-red/30'
      : level === 'High'
        ? 'bg-accent-orange/20 text-accent-orange border-accent-orange/30'
        : level === 'Medium'
          ? 'bg-accent-gold/20 text-accent-gold border-accent-gold/30'
          : 'bg-accent-blue/20 text-accent-blue border-accent-blue/30';

  return <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${colors}`}>{level}</span>;
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-accent-red' : score >= 60 ? 'bg-accent-orange' : score >= 40 ? 'bg-accent-gold' : 'bg-accent-blue';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-elevated rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-mono font-bold w-7 text-right">{score}</span>
    </div>
  );
}

function NodeList({ items, empty }: { items: ScoredInfrastructureNode[]; empty: string }) {
  if (items.length === 0) {
    return <div className="text-[10px] text-text-dim italic">{empty}</div>;
  }

  return (
    <div className="space-y-1.5">
      {items.slice(0, 5).map((item) => (
        <div key={item.symbol} className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] text-white font-medium truncate">{item.symbol}</div>
            <div className="text-[9px] text-text-dim truncate">{item.reason}</div>
          </div>
          <div className="w-20 shrink-0">
            <ScoreBar score={item.impactScore} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InfrastructureRiskSection({ intelligence }: InfrastructureRiskSectionProps) {
  return (
    <div className="p-2.5 rounded bg-elevated/50 border border-border-subtle space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-mono font-bold tracking-wider text-text-dim">INFRASTRUCTURE & SUPPLY CHAIN RISK</div>
        <RiskBadge level={intelligence.riskLevel} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-text-dim">Composite Risk Score</span>
          <span className={`text-[18px] font-mono font-bold ${intelligence.compositeRisk >= 80 ? 'text-accent-red' : intelligence.compositeRisk >= 60 ? 'text-accent-orange' : intelligence.compositeRisk >= 40 ? 'text-accent-gold' : 'text-accent-blue'}`}>
            {intelligence.compositeRisk}
          </span>
        </div>
        <ScoreBar score={intelligence.compositeRisk} />
        {intelligence.summary && (
          <div className="mt-1.5 text-[10px] text-white/80 leading-relaxed">{intelligence.summary}</div>
        )}
      </div>

      <div>
        <div className="text-[9px] font-mono font-bold text-text-dim mb-1.5">STRATEGIC CHOKEPOINTS</div>
        <NodeList items={intelligence.chokepoints} empty="No strategic chokepoints flagged for this event." />
      </div>

      <div>
        <div className="text-[9px] font-mono font-bold text-text-dim mb-1.5">AFFECTED TRADE ROUTES</div>
        <NodeList items={intelligence.tradeRoutes} empty="No trade routes directly affected." />
      </div>

      <div>
        <div className="text-[9px] font-mono font-bold text-text-dim mb-1.5">CRITICAL INFRASTRUCTURE</div>
        <NodeList items={intelligence.infrastructureNodes} empty="No critical infrastructure nodes flagged." />
      </div>

      <div>
        <div className="text-[9px] font-mono font-bold text-text-dim mb-1.5">LOGISTICS SUMMARY</div>
        {intelligence.logisticsImplications.length === 0 ? (
          <div className="text-[10px] text-text-dim italic">No immediate logistics implications identified.</div>
        ) : (
          <ul className="space-y-1">
            {intelligence.logisticsImplications.slice(0, 5).map((imp) => (
              <li key={imp.id} className="text-[10px] text-white/80 leading-snug flex items-start gap-1.5">
                <span className="text-text-dim mt-0.5">•</span>
                <span>{imp.title}: {imp.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
