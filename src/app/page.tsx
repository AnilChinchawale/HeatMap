'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import dynamic from 'next/dynamic';
import Header, { useTheme } from '@/components/Header';
import SignalFeed from '@/components/SignalFeed';
import WorldMap from '@/components/WorldMap';
import MarketTicker from '@/components/MarketTicker';
import PredictionPanel from '@/components/PredictionPanel';
import TrackingPanel from '@/components/TrackingPanel';
import TradingChart from '@/components/TradingChart';
import WaterfallAlerts from '@/components/WaterfallAlerts';
import SourceHealth from '@/components/SourceHealth';
import MobileNavEnhanced from '@/components/MobileNavEnhanced';
import StatsBar from '@/components/StatsBar';
import SituationBrief from '@/components/SituationBrief';
import TwitterFeed from '@/components/TwitterFeed';
import MilitaryTracker from '@/components/MilitaryTracker';
import LiveVideoPanel from '@/components/LiveVideoPanel';
import LiveWebcams from '@/components/LiveWebcams';
import CountryRiskPanel from '@/components/CountryRiskPanel';
import AIInsights from '@/components/AIInsights';
import AttackTimeline from '@/components/AttackTimeline';
import MultiPredictions from '@/components/MultiPredictions';
import NewsChannels from '@/components/NewsChannels';
import FlightRadar from '@/components/FlightRadar';
import FlightTracker from '@/components/FlightTracker';
import CyberFeed from '@/components/CyberFeed';
import CustomDashboard from '@/components/CustomDashboard';
import MapStreams from '@/components/MapStreams';
import RiskDashboard from '@/components/RiskDashboard';
import { usePersistentTimeFilter } from '@/hooks/usePersistentTimeFilter';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import SentimentMeter from '@/components/SentimentMeter';
import RefreshCountdown from '@/components/RefreshCountdown';
import CustomVideoWall from '@/components/CustomVideoWall';
import { useLanguage } from '@/components/LanguageSelector';
import CommandPalette from '@/components/CommandPalette';
import PushNotificationManager from '@/components/PushNotificationManager';
import WorldMonitorLayout from '@/components/WorldMonitorLayout';
import MapFocusView from '@/components/MapFocusView';
import { MapViewProvider } from '@/contexts/MapViewContext';
import BreakingNewsBanner from '@/components/BreakingNewsBanner';
import TVMode from '@/components/TVMode';
import HelpPin from '@/components/HelpPin';
import PortStatusPanel from '@/components/PortStatusPanel';
import GlobalSituationHeader from '@/components/GlobalSituationHeader';
import EnhancedMapControls from '@/components/EnhancedMapControls';
import LiveNewsTicker from '@/components/LiveNewsTicker';
import { Signal, MarketData, PredictionMarket, ThreatLevel, SignalCategory } from '@/types';
import { useSignalBookmarks } from '@/components/BookmarkManager';
import FullscreenToggle from '@/components/FullscreenToggle';
import type { Region } from '@/components/RegionSelector';
import { getThreatLevelFromSignals } from '@/lib/classify';
import { ACTIVE_CONFLICTS } from '@/lib/feeds';

// Dynamic imports for heavy components
const WarRoom = dynamic(() => import('@/components/WarRoom'), { 
  ssr: false,
  loading: () => <div className="h-screen flex items-center justify-center bg-void"><div className="text-accent-green animate-pulse font-mono">Loading War Room...</div></div>
});

const FinanceDashboardFull = dynamic(() => import('@/components/finance/FinanceDashboardFull'), {
  ssr: false,
  loading: () => <div className="h-screen flex items-center justify-center bg-void"><div className="text-accent-green animate-pulse font-mono">Loading Finance Dashboard...</div></div>
});

const EconomicDashboardFull = dynamic(() => import('@/components/economic/EconomicDashboardFull'), {
  ssr: false,
  loading: () => <div className="h-screen flex items-center justify-center bg-void"><div className="text-accent-green animate-pulse font-mono">Loading Economic Dashboard...</div></div>
});

const HealthThreatPanel = dynamic(() => import('@/components/HealthThreatPanel'), {
  ssr: false,
  loading: () => <div className="h-screen flex items-center justify-center bg-void"><div className="text-accent-green animate-pulse font-mono">Loading Health Threat Monitor...</div></div>
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  
  return data;
};

function playAlertSound() {
  if (typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  }
}

type ViewMode = 'dashboard' | 'warroom' | 'mapfocus' | 'finance' | 'economic' | 'health';
type MobileView = 'feed' | 'map' | 'markets' | 'tracking' | 'alerts' | 'economic';

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [activeLayers, setActiveLayers] = useState([
    'flights', 'routes', 'conflicts', 'military', 'chokepoints', 'earthquakes', 
    'spaceports', 'cables', 'pipelines',
    'ai-centers', 'fires', 'gps-jamming', 'outages', 'cyber', 
    'weather', 'displacement', 'clusters', 'supplychain'
  ]);
  const { timeFilter, setTimeFilter, isLoaded: timeFilterLoaded } = usePersistentTimeFilter('24h');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isClient, setIsClient] = useState(false);
  const [prevCriticalCount, setPrevCriticalCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationLevel, setNotificationLevel] = useState<'all' | 'critical'>('critical');
  const [mobileView, setMobileView] = useState<MobileView>('feed');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const [videoWallOpen, setVideoWallOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region>('global');
  const [activeCategories, setActiveCategories] = useState<SignalCategory[]>([
    'conflict', 'military', 'diplomacy', 'cyber', 'disaster', 'economy', 'politics', 'terrorism', 'protest', 'infrastructure', 'health'
  ]);
  
  // Multi-language support
  const { language, changeLanguage, isRTL } = useLanguage();

  // Custom hooks
  const { bookmarks, toggleBookmark, isBookmarked, clearBookmarks, bookmarkCount } = useSignalBookmarks();

  // Theme toggle
  const { isDark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    setIsClient(true);
    
    // Register service worker for push notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope);
        })
        .catch((err) => {
          console.error('[SW] Registration failed:', err);
        });
    }
  }, []);


  // Command Palette shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSearch: () => setCommandPaletteOpen(true),
    onViewChange: (view) => setMobileView(view as MobileView),
    onThemeToggle: toggleTheme,
    onSoundToggle: () => setSoundEnabled(!soundEnabled),
    onRefresh: () => window.location.reload(),
    onEscape: () => {
      setCommandPaletteOpen(false);
      setTvMode(false);
    }
  });

  // Fetch data
  const { data: signalsData, isLoading: signalsLoading, isValidating: signalsValidating } = useSWR<{ signals: Signal[] }>(
    '/api/signals', fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true, revalidateOnReconnect: true }
  );

  const { data: marketsData, isLoading: marketsLoading, isValidating: marketsValidating } = useSWR<{ markets: MarketData[] }>(
    '/api/markets', fetcher,
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const { data: predictionsData, isLoading: predictionsLoading } = useSWR<{ predictions: PredictionMarket[] }>(
    '/api/predictions', fetcher,
    { refreshInterval: 60000 }
  );

  const { data: earthquakesData } = useSWR<{ earthquakes: any[] }>(
    '/api/earthquakes', fetcher,
    { refreshInterval: 120000 }
  );

  const { data: conflictsData } = useSWR<{ conflicts: any[] }>(
    '/api/conflicts', fetcher,
    { refreshInterval: 300000 } // 5 minutes
  );

  useEffect(() => {
    if (signalsData || marketsData || predictionsData) setLastUpdate(new Date());
  }, [signalsData, marketsData, predictionsData]);

  const signals = signalsData?.signals || [];
  
  // Filter signals by time range
  const now = new Date();
  const timeRangeMs = {
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  const filteredSignals = signals.filter(s => {
    const cutoff = timeRangeMs[timeFilter as keyof typeof timeRangeMs] || timeRangeMs['24h'];
    return new Date(s.timestamp).getTime() > now.getTime() - cutoff;
  });
  
  const markets = marketsData?.markets || [];
  const predictions = predictionsData?.predictions || [];
  const earthquakes = earthquakesData?.earthquakes || [];
  const conflicts = conflictsData?.conflicts || [];

  const threatLevel: ThreatLevel = getThreatLevelFromSignals(signals);
  const breakingNews = signals.find(s => s.severity === 'CRITICAL')?.title;

  const criticalCount = signals.filter(s => s.severity === 'CRITICAL').length;
  const highCount = signals.filter(s => s.severity === 'HIGH').length;
  const militaryCount = signals.filter(s => s.category === 'military').length;

  useEffect(() => {
    const relevantCount = notificationLevel === 'all'
      ? signals.filter(s => s.severity === 'CRITICAL' || s.severity === 'HIGH').length
      : criticalCount;
    if (soundEnabled && relevantCount > prevCriticalCount && prevCriticalCount > 0) playAlertSound();
    setPrevCriticalCount(relevantCount);
  }, [criticalCount, soundEnabled, prevCriticalCount, notificationLevel, signals]);

  const handleLayerToggle = useCallback((layer: string) => {
    setActiveLayers(prev => prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]);
  }, []);

  const handleSignalClick = useCallback((signal: Signal) => {
    if (signal.sourceUrl) window.open(signal.sourceUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const handleCategoryToggle = useCallback((category: SignalCategory) => {
    setActiveCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  }, []);

  // Skeleton loading - show immediate value while hydrating
  if (!isClient) {
    return (
      <div className="h-screen flex flex-col bg-void overflow-hidden">
        {/* Skeleton Header */}
        <header className="bg-elevated border-b border-border-default px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-green/30 to-accent-blue/20 flex items-center justify-center border border-accent-green/30">
              <span className="text-accent-green text-xl">🌐</span>
            </div>
            <div>
              <h1 className="font-mono text-sm font-bold tracking-wider text-accent-green flex items-center gap-2">
                GLOBENEWS
                <span className="px-1.5 py-0.5 bg-accent-red/20 text-[8px] rounded border border-accent-red/30 text-accent-red animate-pulse">LIVE</span>
              </h1>
              <p className="text-[9px] text-text-muted">Real-time global intelligence</p>
            </div>
          </div>
          {/* Value Proposition Stats */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-center">
              <div className="text-accent-red font-mono text-lg font-bold">12</div>
              <div className="text-[8px] text-text-muted">CONFLICTS</div>
            </div>
            <div className="text-center">
              <div className="text-accent-orange font-mono text-lg font-bold">54</div>
              <div className="text-[8px] text-text-muted">SOURCES</div>
            </div>
            <div className="text-center">
              <div className="text-accent-green font-mono text-lg font-bold">30s</div>
              <div className="text-[8px] text-text-muted">REFRESH</div>
            </div>
          </div>
        </header>

        {/* Skeleton Main - 3 Panel Layout */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Panel - News Feed Skeleton */}
          <aside className="hidden lg:block w-[340px] border-r border-border-default p-2 space-y-2">
            <div className="px-3 py-2 bg-elevated rounded border border-border-subtle">
              <div className="text-[11px] font-mono text-accent-red font-bold">📡 LIVE INTEL FEED</div>
            </div>
            {[1,2,3,4,5].map(i => (
              <div key={i} className="p-3 bg-elevated/50 rounded border border-border-subtle animate-pulse">
                <div className="h-3 bg-white/10 rounded w-3/4 mb-2" />
                <div className="h-2 bg-white/5 rounded w-full mb-1" />
                <div className="h-2 bg-white/5 rounded w-2/3" />
              </div>
            ))}
          </aside>

          {/* Center - Map Skeleton */}
          <section className="flex-1 relative">
            <div className="absolute inset-0 bg-[#0a1628]">
              {/* Map placeholder with grid */}
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'linear-gradient(rgba(0,255,136,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.1) 1px, transparent 1px)',
                backgroundSize: '50px 50px'
              }} />
              {/* Hotspot indicators */}
              <div className="absolute top-1/3 left-1/3 w-4 h-4 bg-accent-red/50 rounded-full animate-ping" />
              <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-accent-orange/50 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
              <div className="absolute top-2/3 right-1/3 w-4 h-4 bg-accent-red/50 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
              {/* Loading indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse" />
                <span className="text-[10px] text-white font-mono">Loading map data...</span>
                <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-accent-green animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </section>

          {/* Right Panel - Insights Skeleton */}
          <aside className="hidden lg:block w-[340px] border-l border-border-default p-2 space-y-2 overflow-y-auto">
            <div className="p-3 bg-elevated rounded border border-accent-red/30">
              <div className="text-[10px] font-mono text-accent-red font-bold mb-2">⚠️ THREAT LEVEL</div>
              <div className="h-8 bg-accent-red/20 rounded animate-pulse" />
            </div>
            <div className="p-3 bg-elevated rounded border border-border-subtle">
              <div className="text-[10px] font-mono text-accent-green font-bold mb-2">📺 LIVE STREAMS</div>
              <div className="grid grid-cols-2 gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className="aspect-video bg-white/5 rounded animate-pulse" />
                ))}
              </div>
            </div>
            <div className="p-3 bg-elevated rounded border border-border-subtle">
              <div className="text-[10px] font-mono text-accent-blue font-bold mb-2">🧠 AI INSIGHTS</div>
              <div className="space-y-2">
                <div className="h-2 bg-white/10 rounded w-full" />
                <div className="h-2 bg-white/5 rounded w-3/4" />
              </div>
            </div>
          </aside>
        </main>

        {/* Skeleton Footer */}
        <footer className="bg-elevated border-t border-border-default px-4 py-1.5 hidden lg:flex items-center justify-between">
          <div className="flex items-center gap-4 text-[9px] text-text-muted">
            <span>🔴 12 Active Conflicts</span>
            <span>🟡 8 Economic Alerts</span>
            <span>⚡ 4 Military Movements</span>
          </div>
          <div className="text-[9px] text-text-dim font-mono">Powered by 54+ intelligence sources</div>
        </footer>
      </div>
    );
  }

  // War Room View
  if (viewMode === 'warroom') {
    return (
      <div className="h-screen flex flex-col bg-void">
        {/* Mode Toggle */}
        <div className="bg-void border-b border-border-default px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('dashboard')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              📊 DASHBOARD
            </button>
            <button
              onClick={() => setViewMode('warroom')}
              className="px-3 py-1 rounded text-[10px] font-mono bg-accent-red/20 text-accent-red"
            >
              ⚔️ WAR ROOM
            </button>
            <button
              onClick={() => setViewMode('health')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              🦠 HEALTH
            </button>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono ${soundEnabled ? 'bg-accent-green/20 text-accent-green' : 'bg-elevated text-text-dim'}`}
          >
            {soundEnabled ? '🔔' : '🔕'} ALERTS
          </button>
          <button
            onClick={() => setNotificationLevel(notificationLevel === 'critical' ? 'all' : 'critical')}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono ${notificationLevel === 'all' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-elevated text-text-dim'}`}
            title={notificationLevel === 'critical' ? 'Only Critical notifications' : 'All updates notifications'}
          >
            {notificationLevel === 'critical' ? '🔴' : '🔵'} {notificationLevel === 'critical' ? 'CRIT' : 'ALL'}
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <WarRoom signals={signals} conflicts={conflicts} />
        </div>
      </div>
    );
  }

  // Map Focus View
  if (viewMode === 'mapfocus') {
    return (
      <div className="h-screen flex flex-col bg-void overflow-hidden">
        <BreakingNewsBanner signals={signals} />
        <MapViewProvider>
        <MapFocusView
          signals={signals}
          conflicts={conflicts}
          earthquakes={earthquakes}
          activeLayers={activeLayers}
          onLayerToggle={handleLayerToggle}
          onExit={() => setViewMode('dashboard')}
        />
        </MapViewProvider>
      </div>
    );
  }

  // Finance View
  if (viewMode === 'finance') {
    return (
      <div className="h-screen flex flex-col bg-void">
        {/* Mode Toggle */}
        <div className="bg-void border-b border-border-default px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('dashboard')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              📊 DASHBOARD
            </button>
            <button
              onClick={() => setViewMode('warroom')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              ⚔️ WAR ROOM
            </button>
            <button
              onClick={() => setViewMode('finance')}
              className="px-3 py-1 rounded text-[10px] font-mono bg-accent-gold/20 text-accent-gold"
            >
              💰 FINANCE
            </button>
            <button
              onClick={() => setViewMode('economic')}
              className="px-3 py-1 rounded text-[10px] font-mono bg-[#378ADD]/20 text-[#378ADD]"
            >
              🏛️ ECONOMIC
            </button>
            <button
              onClick={() => setViewMode('health')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              🦠 HEALTH
            </button>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono ${soundEnabled ? 'bg-accent-green/20 text-accent-green' : 'bg-elevated text-text-dim'}`}
          >
            {soundEnabled ? '🔔' : '🔕'} ALERTS
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <FinanceDashboardFull />
        </div>
      </div>
    );
  }

  // Health Threat View
  if (viewMode === 'health') {
    return (
      <div className="h-screen flex flex-col bg-void">
        {/* Mode Toggle */}
        <div className="bg-void border-b border-border-default px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('dashboard')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              📊 DASHBOARD
            </button>
            <button
              onClick={() => setViewMode('warroom')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              ⚔️ WAR ROOM
            </button>
            <button
              onClick={() => setViewMode('finance')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              💰 FINANCE
            </button>
            <button
              onClick={() => setViewMode('economic')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              📈 ECONOMIC
            </button>
            <span className="px-3 py-1 rounded text-[10px] font-mono text-accent-green bg-accent-green/10">
              🦠 HEALTH
            </span>
          </div>
          <FullscreenToggle />
        </div>
        <div className="flex-1 overflow-hidden">
          <HealthThreatPanel />
        </div>
      </div>
    );
  }

  // Economic View
  if (viewMode === 'economic') {
    return (
      <div className="h-screen flex flex-col bg-void">
        {/* Mode Toggle */}
        <div className="bg-void border-b border-border-default px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('dashboard')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              📊 DASHBOARD
            </button>
            <button
              onClick={() => setViewMode('warroom')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              ⚔️ WAR ROOM
            </button>
            <button
              onClick={() => setViewMode('finance')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              💰 FINANCE
            </button>
            <button
              onClick={() => setViewMode('economic')}
              className="px-3 py-1 rounded text-[10px] font-mono bg-[#378ADD]/20 text-[#378ADD]"
            >
              🏛️ ECONOMIC
            </button>
            <button
              onClick={() => setViewMode('health')}
              className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white"
            >
              🦠 HEALTH
            </button>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono ${soundEnabled ? 'bg-accent-green/20 text-accent-green' : 'bg-elevated text-text-dim'}`}
          >
            {soundEnabled ? '🔔' : '🔕'} ALERTS
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <EconomicDashboardFull />
        </div>
      </div>
    );
  }

  // Dashboard View
  return (
    <div className={`h-screen flex flex-col bg-void overflow-hidden ${isRTL ? 'rtl' : 'ltr'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        signals={filteredSignals.map(s => ({ title: s.title, country: undefined, severity: s.severity }))}
        onNavigate={(view) => { if (view === 'warroom') setViewMode('warroom'); else setViewMode('dashboard'); }}
        onToggleLayer={handleLayerToggle}
      />

      {/* TV Mode */}
      <TVMode isActive={tvMode} onExit={() => setTvMode(false)} />

      {/* Custom Video Wall */}
      <CustomVideoWall isOpen={videoWallOpen} onClose={() => setVideoWallOpen(false)} />

      {/* Breaking News Banner */}
      <BreakingNewsBanner signals={filteredSignals} notificationLevel={notificationLevel} />

      {/* Mode Toggle - Desktop */}
      <div className="hidden lg:flex bg-void border-b border-border-default px-4 py-1.5 items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('dashboard')}
            className="px-3 py-1 rounded text-[10px] font-mono bg-accent-green/20 text-accent-green"
          >
            📊 DASHBOARD
          </button>
          <button
            onClick={() => setViewMode('warroom')}
            className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white hover:bg-white/5"
          >
            ⚔️ WAR ROOM
          </button>
          <button
            onClick={() => setTvMode(true)}
            className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white hover:bg-white/5"
          >
            📺 TV MODE
          </button>
          <button
            onClick={() => setVideoWallOpen(true)}
            className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white hover:bg-white/5"
          >
            🎬 VIDEO WALL
          </button>
          <button
            onClick={() => setViewMode('mapfocus')}
            className='px-3 py-1 rounded text-[10px] font-mono text-accent-blue bg-accent-blue/10 hover:bg-accent-blue/20 transition-all'
          >
            🗺️ MAP FOCUS
          </button>
          <button
            onClick={() => setViewMode('finance')}
            className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white hover:bg-white/5"
          >
            💰 FINANCE
          </button>
          <button
            onClick={() => setViewMode('economic')}
            className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white hover:bg-white/5"
          >
            🏛️ ECONOMIC
          </button>
          <button
            onClick={() => setViewMode('health')}
            className="px-3 py-1 rounded text-[10px] font-mono text-text-dim hover:text-white hover:bg-white/5"
          >
            🦠 HEALTH
          </button>
        </div>
        <div className="flex items-center gap-3">
          <PushNotificationManager signals={signals} criticalCount={criticalCount} />
          <span className="text-[9px] text-text-dim font-mono hidden xl:inline">{filteredSignals.length} / {signals.length} signals</span>
        </div>
      </div>

      <Header 
        threatLevel={threatLevel}
        breakingNews={breakingNews}
        lastUpdate={lastUpdate}
        signalCount={signals.length}
        criticalCount={criticalCount}
        language={language}
        onLanguageChange={changeLanguage}
        isDark={isDark}
        onThemeToggle={toggleTheme}
      />

      {/* NEW: Global Situation Header */}
      <GlobalSituationHeader 
        threatLevel={threatLevel} 
        signals={signals} 
        activeConflicts={ACTIVE_CONFLICTS.length} 
        lastUpdate={lastUpdate} 
      />



      {/* Desktop Layout — WorldMonitor-style with sidebar + PR24 enhancements */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <WorldMonitorLayout signals={signals} activeLayers={activeLayers} onLayerToggle={handleLayerToggle} defcon={3} criticalCount={criticalCount}>
          <CustomDashboard
            signals={filteredSignals}
            markets={markets}
            earthquakes={earthquakes}
            conflicts={conflicts}
            signalsLoading={signalsLoading || signalsValidating}
            marketsLoading={marketsLoading || marketsValidating}
            activeLayers={activeLayers}
            onLayerToggle={handleLayerToggle}
            onSignalClick={handleSignalClick}
            isBookmarked={isBookmarked}
            onBookmark={toggleBookmark}
          />
        </WorldMonitorLayout>
      </div>

      {/* NEW: Floating Map Controls (Desktop overlay) */}
      <div className="hidden lg:block absolute top-[140px] right-[300px] z-10">
        <EnhancedMapControls activeLayers={activeLayers} onLayerToggle={handleLayerToggle} />
      </div>

      {/* Mobile Layout */}
      <main className="lg:hidden flex-1 overflow-hidden pb-20">
        {/* Mobile time filter bar */}
        <div className="flex items-center gap-1 px-2 py-1.5 bg-elevated border-b border-border-default overflow-x-auto">
          <span className="text-[9px] text-text-dim font-mono shrink-0">TIME:</span>
          {['1h', '6h', '24h', '48h', '7d'].map(filter => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono shrink-0 transition-all ${
                timeFilter === filter
                  ? 'bg-accent-green/20 text-accent-green'
                  : 'text-text-dim hover:text-text-muted'
              }`}
            >
              {filter}
            </button>
          ))}
          <span className="text-[9px] text-text-dim font-mono ml-auto shrink-0">{filteredSignals.length}/{signals.length}</span>
        </div>
        {mobileView === 'feed' && <SignalFeed signals={filteredSignals} loading={signalsLoading || signalsValidating} onSignalClick={handleSignalClick} />}
        {mobileView === 'map' && (
          <div className="h-full p-2 relative">
            <WorldMap signals={filteredSignals} activeLayers={activeLayers} onLayerToggle={handleLayerToggle} earthquakes={earthquakes} />
            <EnhancedMapControls activeLayers={activeLayers} onLayerToggle={handleLayerToggle} />
          </div>
        )}
        {mobileView === 'markets' && (
          <div className="h-full overflow-y-auto p-2 space-y-2">
            <SituationBrief />
            <SituationBrief />
            <TradingChart symbol="XAUUSD" height={250} />
            <MarketTicker markets={markets} loading={marketsLoading || marketsValidating} />
            <PredictionPanel predictions={predictions} loading={predictionsLoading} />
          </div>
        )}
        {mobileView === 'tracking' && (
          <div className="h-full overflow-y-auto p-2 space-y-2">
            <SituationBrief />
            <MilitaryTracker />
            <FlightTracker />
            <TrackingPanel earthquakes={earthquakes} />
            <PortStatusPanel />
            <TwitterFeed />
            <div className="glass-panel">
              <div className="px-3 py-2 border-b border-border-subtle bg-panel/50">
                <span className="font-mono text-[11px] font-bold text-accent-red">🔥 HOTSPOTS</span>
              </div>
              <div className="p-2 space-y-1">
                {ACTIVE_CONFLICTS.map(c => (
                  <div key={c.name} className="flex items-center justify-between px-2 py-1.5 bg-elevated/50 rounded">
                    <span className="text-[10px] text-white">{c.name}</span>
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${c.intensity === 'high' ? 'bg-accent-red/20 text-accent-red' : 'bg-accent-orange/20 text-accent-orange'}`}>
                      {c.intensity.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {mobileView === 'alerts' && (
          <div className="h-full overflow-y-auto p-2 space-y-2">
            {/* 🌊 Waterfall Alerts - Ground Station Style */}
            <div className="h-48">
              <WaterfallAlerts signals={signals} maxAlerts={15} />
            </div>
            
            {/* 📡 Source Health Monitor */}
            <SourceHealth refreshInterval={60000} />
            
            {/* Critical Alerts List */}
            <div className="bg-elevated rounded-lg border border-border-subtle">
              <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-accent-red">🚨 CRITICAL ALERTS</span>
                <span className="text-[10px] text-text-dim font-mono">{signals.filter(s => s.severity === 'CRITICAL').length}</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {signals.filter(s => s.severity === 'CRITICAL').slice(0, 10).map(signal => (
                  <div key={signal.id} className="px-3 py-2 border-b border-border-subtle last:border-b-0 hover:bg-white/5 transition-colors">
                    <div className="flex items-start gap-2">
                      <span className="text-accent-red text-xs mt-0.5">●</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-white font-medium truncate">{signal.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-text-dim">{signal.source}</span>
                          <span className="text-[9px] text-text-dim">•</span>
                          <span className="text-[9px] text-text-dim">{signal.timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {signals.filter(s => s.severity === 'CRITICAL').length === 0 && (
                  <div className="px-3 py-4 text-center text-[11px] text-text-dim">
                    No critical alerts at this time
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {mobileView === 'economic' && (
          <div className="h-full overflow-hidden">
            <EconomicDashboardFull />
          </div>
        )}
      </main>

      <MobileNavEnhanced activeView={mobileView} onViewChange={setMobileView} criticalCount={criticalCount} />

      {/* RSS News Ticker - Desktop */}
      <div className="hidden lg:block">
        <StatsBar activeConflicts={ACTIVE_CONFLICTS.length} militaryAlerts={militaryCount} highSeverity={highCount} criticalSeverity={criticalCount} timeFilter={timeFilter} onTimeFilterChange={setTimeFilter} />
      </div>
      {/* Help Pin - Floating help button */}
      <HelpPin />

      {/* NEW: Live News Ticker */}
      <LiveNewsTicker signals={signals} />
    </div>
  );
}
