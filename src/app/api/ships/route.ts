import { NextResponse } from 'next/server';

// Ship tracking for strategic chokepoints (Hormuz, Red Sea, Suez, etc.)
// Uses MarineTraffic-style data (simulated for demo, integrate with AIS in production)

interface Ship {
  mmsi: string;
  name: string;
  type: string;
  flag: string;
  lat: number;
  lon: number;
  speed: number;
  course: number;
  destination?: string;
  eta?: string;
  length?: number;
  draught?: number;
  cargo?: string;
  status: 'underway' | 'anchored' | 'moored' | 'not-under-command';
  lastUpdate: number;
  risk?: 'low' | 'medium' | 'high' | 'critical';
}

// Strategic regions to monitor
const REGIONS = {
  hormuz: {
    name: 'Strait of Hormuz',
    bounds: { minLat: 24, maxLat: 28, minLon: 54, maxLon: 58 },
    risk: 'critical',
    dailyTankers: 21,
    oilMbpd: 17.4,
  },
  redsea: {
    name: 'Red Sea / Bab-el-Mandeb',
    bounds: { minLat: 12, maxLat: 20, minLon: 40, maxLon: 46 },
    risk: 'high',
    dailyTankers: 15,
    note: 'Houthi attack zone',
  },
  suez: {
    name: 'Suez Canal',
    bounds: { minLat: 29.5, maxLat: 31.5, minLon: 32, maxLon: 33 },
    risk: 'medium',
    dailyShips: 50,
    tradePct: 12,
  },
  taiwan: {
    name: 'Taiwan Strait',
    bounds: { minLat: 22, maxLat: 26, minLon: 117, maxLon: 122 },
    risk: 'high',
    note: 'Military tensions',
  },
  malacca: {
    name: 'Strait of Malacca',
    bounds: { minLat: 0, maxLat: 6, minLon: 98, maxLon: 105 },
    risk: 'low',
    tradePct: 25,
  },
  persian: {
    name: 'Persian Gulf',
    bounds: { minLat: 24, maxLat: 30, minLon: 48, maxLon: 56 },
    risk: 'high',
    oilMbpd: 24,
  },
} as const;

// Ship types of interest
const SHIP_TYPES = {
  tanker: { icon: '🛢️', color: '#ff8800', priority: 1 },
  lng: { icon: '🔥', color: '#00aaff', priority: 1 },
  container: { icon: '📦', color: '#00cc66', priority: 2 },
  bulk: { icon: '⚓', color: '#888888', priority: 3 },
  military: { icon: '🎖️', color: '#ff0000', priority: 0 },
  cargo: { icon: '🚢', color: '#666666', priority: 3 },
};

// Simulated ship data for demo (in production, use VesselFinder, MarineTraffic, or AIS API)
function generateShipsForRegion(region: keyof typeof REGIONS, count: number): Ship[] {
  const bounds = REGIONS[region].bounds;
  const ships: Ship[] = [];
  
  const types = ['tanker', 'tanker', 'tanker', 'lng', 'container', 'container', 'bulk', 'cargo'];
  const flags = ['🇱🇷 Liberia', '🇵🇦 Panama', '🇲🇭 Marshall Is.', '🇸🇬 Singapore', '🇬🇷 Greece', '🇳🇴 Norway', '🇨🇳 China', '🇯🇵 Japan', '🇮🇳 India', '🇮🇷 Iran', '🇸🇦 Saudi Arabia'];
  const destinations = ['Jebel Ali', 'Singapore', 'Rotterdam', 'Shanghai', 'Mumbai', 'Yanbu', 'Fujairah', 'Ras Tanura', 'Basra', 'Bandar Abbas'];
  
  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const lat = bounds.minLat + Math.random() * (bounds.maxLat - bounds.minLat);
    const lon = bounds.minLon + Math.random() * (bounds.maxLon - bounds.minLon);
    
    ships.push({
      mmsi: `${200000000 + Math.floor(Math.random() * 800000000)}`,
      name: `${['ATLANTIC', 'PACIFIC', 'ARABIAN', 'PERSIAN', 'STAR', 'OCEAN', 'GLOBAL', 'MARITIME'][Math.floor(Math.random() * 8)]} ${['SPIRIT', 'PIONEER', 'FORTUNE', 'GLORY', 'PRIDE', 'DREAM', 'VOYAGER'][Math.floor(Math.random() * 7)]}`,
      type,
      flag: flags[Math.floor(Math.random() * flags.length)],
      lat,
      lon,
      speed: type === 'tanker' ? 10 + Math.random() * 5 : 12 + Math.random() * 8,
      course: Math.floor(Math.random() * 360),
      destination: destinations[Math.floor(Math.random() * destinations.length)],
      eta: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      length: type === 'tanker' ? 250 + Math.floor(Math.random() * 100) : 150 + Math.floor(Math.random() * 150),
      draught: 10 + Math.random() * 10,
      cargo: type === 'tanker' ? 'Crude Oil' : type === 'lng' ? 'LNG' : type === 'container' ? 'Containers' : 'General',
      status: Math.random() > 0.8 ? 'anchored' : 'underway',
      lastUpdate: Date.now() - Math.floor(Math.random() * 3600000),
      risk: REGIONS[region].risk === 'critical' ? 'high' : REGIONS[region].risk,
    });
  }
  
  return ships;
}

// Add known attacked/incident ships
function getIncidentShips(): Ship[] {
  return [
    {
      mmsi: '538006491',
      name: 'GALAXY LEADER',
      type: 'cargo',
      flag: '🇬🇧 UK',
      lat: 14.82,
      lon: 42.93,
      speed: 0,
      course: 0,
      destination: 'DETAINED',
      status: 'not-under-command',
      lastUpdate: Date.now(),
      risk: 'critical',
      cargo: 'Vehicles',
    },
    {
      mmsi: '636019517',
      name: 'TRUE CONFIDENCE',
      type: 'bulk',
      flag: '🇱🇷 Liberia',
      lat: 14.15,
      lon: 42.75,
      speed: 0,
      course: 0,
      destination: 'ATTACKED',
      status: 'not-under-command',
      lastUpdate: Date.now(),
      risk: 'critical',
    },
  ];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') || 'hormuz';
  const type = searchParams.get('type'); // Filter by ship type
  
  const regionData = REGIONS[region as keyof typeof REGIONS];
  if (!regionData) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }
  
  // Generate ships for region
  const shipCount = region === 'hormuz' ? 35 : region === 'redsea' ? 25 : region === 'suez' ? 30 : 20;
  let ships = generateShipsForRegion(region as keyof typeof REGIONS, shipCount);
  
  // Add incident ships for Red Sea
  if (region === 'redsea') {
    ships = [...getIncidentShips(), ...ships];
  }
  
  // Filter by type if specified
  if (type) {
    ships = ships.filter(s => s.type === type);
  }
  
  // Sort by risk, then type priority
  ships.sort((a, b) => {
    const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const riskDiff = (riskOrder[a.risk || 'low'] || 3) - (riskOrder[b.risk || 'low'] || 3);
    if (riskDiff !== 0) return riskDiff;
    
    const typeA = SHIP_TYPES[a.type as keyof typeof SHIP_TYPES]?.priority || 99;
    const typeB = SHIP_TYPES[b.type as keyof typeof SHIP_TYPES]?.priority || 99;
    return typeA - typeB;
  });
  
  // Stats
  const stats = {
    total: ships.length,
    byType: {
      tankers: ships.filter(s => s.type === 'tanker').length,
      lng: ships.filter(s => s.type === 'lng').length,
      container: ships.filter(s => s.type === 'container').length,
      bulk: ships.filter(s => s.type === 'bulk').length,
      other: ships.filter(s => !['tanker', 'lng', 'container', 'bulk'].includes(s.type)).length,
    },
    byStatus: {
      underway: ships.filter(s => s.status === 'underway').length,
      anchored: ships.filter(s => s.status === 'anchored').length,
      incidents: ships.filter(s => s.status === 'not-under-command').length,
    },
    atRisk: ships.filter(s => s.risk === 'high' || s.risk === 'critical').length,
  };
  
  return NextResponse.json({
    region: {
      id: region,
      ...regionData,
    },
    ships: ships.slice(0, 100),
    stats,
    timestamp: Date.now(),
    note: 'Demo data - integrate with VesselFinder/MarineTraffic API for production',
    availableRegions: Object.keys(REGIONS),
  });
}
