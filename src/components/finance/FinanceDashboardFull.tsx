'use client';

import { useState } from 'react';
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import LayerTogglePanel from './LayerTogglePanel';
import PipelineStatus from './PipelineStatus';
import CryptoSectors from './CryptoSectors';
import AiTokens from './AiTokens';
import MetalsMaterials from './MetalsMaterials';
import DefiTokens from './DefiTokens';
import CentralBankWatch from './CentralBankWatch';
import MacroStress from './MacroStress';
import NewsPanel from './NewsPanel';
import FinanceTicker from './FinanceTicker';
import MarketComposite from './MarketComposite';
import FinanceLiveNews from './FinanceLiveNews';
import CyberThreatPanel from './CyberThreatPanel';
import WorldClockPanel from '@/components/WorldClockPanel';
import EconomicPanel from '@/components/EconomicPanel';
import EventMarketIntelligencePanel from './EventMarketIntelligencePanel';

const WorldMap = dynamic(() => import('@/components/WorldMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-[#0a1628]">
      <span className="text-[10px] font-mono text-white/40 animate-pulse">Loading map...</span>
    </div>
  ),
});

const fetcher = (url: string) => fetch(url).then(r => r.json());

const DEFAULT_LAYERS = ['exchanges', 'centers', 'banks', 'hubs', 'cables', 'pipelines'];

export default function FinanceDashboardFull() {
  const [activeLayers, setActiveLayers] = useState(DEFAULT_LAYERS);
  const { data: financeData } = useSWR('/api/finance', fetcher, { refreshInterval: 30000 });

  const toggleLayer = (id: string) => {
    setActiveLayers((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Top ticker */}
      <div className="shrink-0">
        <FinanceTicker data={financeData} />
      </div>

      {/* 3-column layout */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[280px_1fr_340px] gap-2 p-2">
        {/* LEFT COLUMN */}
        <div className="hidden lg:flex flex-col gap-2 overflow-y-auto">
          <LayerTogglePanel activeLayers={activeLayers} onToggle={toggleLayer} />
          <PipelineStatus />
        </div>

        {/* CENTER COLUMN — no overflow, natural height */}
        <div className="flex flex-col min-h-0 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {/* 1. MAP — taller, flex-1 to fill available space */}
          <div className="shrink-0 min-h-[55vh] relative border-b border-white/5 overflow-hidden">
            <WorldMap
              activeLayers={[]}
              onLayerToggle={() => {}}
              financeMode={true}
              financeLayers={activeLayers}
              height={undefined}
            />
          </div>

          {/* 2. LIVE HEADLINES — auto-scroll, natural height */}
          <FinanceLiveNews />

          {/* 3. CRYPTO SECTORS + AI TOKENS — side by side, natural height */}
          <div className="shrink-0 grid grid-cols-2 border-b border-white/5">
            <CryptoSectors compact />
            <AiTokens compact />
          </div>
        </div>

        {/* RIGHT COLUMN — worldmonitor style panels */}
        <div className="hidden lg:flex flex-col gap-0 overflow-y-auto h-full border-l border-white/5 scrollbar-thin">
          {/* Event Market Intelligence */}
          <div className="shrink-0">
            <EventMarketIntelligencePanel />
          </div>

          {/* World Clock — strategic timezones */}
          <div className="shrink-0 h-[200px] overflow-hidden">
            <WorldClockPanel />
          </div>

          {/* Economic Panel — indicators, oil, currency, central banks */}
          <div className="shrink-0 h-[280px] overflow-hidden">
            <EconomicPanel />
          </div>

          {/* Cyber Threats */}
          <div className="shrink-0">
            <CyberThreatPanel />
          </div>

          {/* News panels */}
          <div className="shrink-0">
            <NewsPanel category="forex" title="FOREX / ECONOMIC" maxArticles={3} accentColor="cyan" />
          </div>
          <div className="shrink-0">
            <NewsPanel category="fixed-income" title="FIXED INCOME" maxArticles={3} accentColor="blue" />
          </div>
          <div className="shrink-0">
            <MetalsMaterials />
          </div>
          <div className="shrink-0">
            <CryptoSectors />
          </div>
          <div className="shrink-0">
            <DefiTokens />
          </div>
          <div className="shrink-0">
            <NewsPanel category="commodities" title="COMMODITIES NEWS" maxArticles={3} accentColor="amber" />
          </div>
          <div className="shrink-0">
            <NewsPanel category="crypto" title="CRYPTO NEWS" maxArticles={3} accentColor="purple" />
          </div>
          <div className="shrink-0">
            <CentralBankWatch />
          </div>
          <div className="shrink-0">
            <MacroStress />
          </div>
        </div>
      </div>

      {/* Mobile-only basic panels */}
      <div className="lg:hidden flex flex-col gap-2 p-2 overflow-y-auto">
        <MarketComposite composite={financeData?.composite} />
        <MetalsMaterials />
        <DefiTokens />
        <CentralBankWatch />
        <MacroStress />
      </div>
    </div>
  );
}
