// Critical Infrastructure Data for Map Layers

export interface InfrastructurePoint {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  country: string;
  description?: string;
  status?: 'active' | 'inactive' | 'unknown';
  risk?: 'low' | 'medium' | 'high' | 'critical';
}

// 🚀 SPACEPORTS - Launch facilities
export const SPACEPORTS: InfrastructurePoint[] = [
  // USA
  { id: 'space-1', name: 'Kennedy Space Center', type: 'orbital', lat: 28.57, lon: -80.65, country: 'USA', status: 'active' },
  { id: 'space-2', name: 'Vandenberg SFB', type: 'orbital', lat: 34.74, lon: -120.57, country: 'USA', status: 'active' },
  { id: 'space-3', name: 'SpaceX Starbase', type: 'orbital', lat: 25.99, lon: -97.15, country: 'USA', status: 'active', description: 'Starship launch site' },
  { id: 'space-4', name: 'Wallops Flight Facility', type: 'orbital', lat: 37.94, lon: -75.47, country: 'USA', status: 'active' },
  // Russia
  { id: 'space-5', name: 'Baikonur Cosmodrome', type: 'orbital', lat: 45.96, lon: 63.31, country: 'Kazakhstan/Russia', status: 'active' },
  { id: 'space-6', name: 'Plesetsk Cosmodrome', type: 'orbital', lat: 62.93, lon: 40.57, country: 'Russia', status: 'active' },
  { id: 'space-7', name: 'Vostochny Cosmodrome', type: 'orbital', lat: 51.88, lon: 128.33, country: 'Russia', status: 'active' },
  // China
  { id: 'space-8', name: 'Jiuquan', type: 'orbital', lat: 40.96, lon: 100.29, country: 'China', status: 'active' },
  { id: 'space-9', name: 'Wenchang', type: 'orbital', lat: 19.61, lon: 110.95, country: 'China', status: 'active' },
  { id: 'space-10', name: 'Xichang', type: 'orbital', lat: 28.25, lon: 102.03, country: 'China', status: 'active' },
  // Others
  { id: 'space-11', name: 'Guiana Space Centre', type: 'orbital', lat: 5.24, lon: -52.77, country: 'France/ESA', status: 'active' },
  { id: 'space-12', name: 'Satish Dhawan (SHAR)', type: 'orbital', lat: 13.72, lon: 80.23, country: 'India', status: 'active' },
  { id: 'space-13', name: 'Tanegashima', type: 'orbital', lat: 30.40, lon: 130.97, country: 'Japan', status: 'active' },
];

// 🔌 UNDERSEA CABLES - Critical internet infrastructure
export const UNDERSEA_CABLES: { id: string; name: string; points: [number, number][]; capacity: string; owners: string }[] = [
  {
    id: 'cable-1',
    name: 'SEA-ME-WE 3',
    points: [[1.29, 103.85], [6.93, 79.85], [12.07, 45.02], [31.20, 32.30], [36.80, 10.18], [43.30, -8.40]],
    capacity: '960 Gbps',
    owners: 'Singapore Telecom, Telekom Malaysia'
  },
  {
    id: 'cable-2', 
    name: 'FLAG Europe-Asia',
    points: [[22.30, 114.17], [6.93, 79.85], [25.28, 55.30], [31.20, 32.30], [35.50, 23.73], [37.97, 23.73], [40.85, 29.05], [41.01, 28.97]],
    capacity: '10 Tbps',
    owners: 'Reliance Globalcom'
  },
  {
    id: 'cable-3',
    name: 'TAT-14',
    points: [[40.70, -74.00], [51.50, -0.12], [52.52, 4.90], [55.68, 12.57]],
    capacity: '3.2 Tbps',
    owners: 'AT&T, BT, Deutsche Telekom'
  },
  {
    id: 'cable-4',
    name: 'Asia-America Gateway',
    points: [[35.68, 139.69], [22.30, 114.17], [1.35, 103.82], [37.57, -122.38]],
    capacity: '2 Tbps',
    owners: 'AT&T, China Telecom, NTT'
  },
  {
    id: 'cable-5',
    name: 'MAREA',
    points: [[39.45, -74.45], [43.46, -3.80]],
    capacity: '200 Tbps',
    owners: 'Microsoft, Facebook, Telxius'
  },
];

// 🛢 PIPELINES - Major energy infrastructure
export const PIPELINES: { id: string; name: string; type: 'oil' | 'gas'; points: [number, number][]; status: string }[] = [
  {
    id: 'pipe-1',
    name: 'Nord Stream 1 & 2',
    type: 'gas',
    points: [[59.95, 30.32], [55.04, 8.42], [54.18, 12.09]],
    status: 'sabotaged'
  },
  {
    id: 'pipe-2',
    name: 'Druzhba Pipeline',
    type: 'oil',
    points: [[52.10, 50.12], [51.76, 36.19], [50.45, 30.52], [52.23, 21.01], [52.52, 13.41]],
    status: 'active'
  },
  {
    id: 'pipe-3',
    name: 'TurkStream',
    type: 'gas',
    points: [[44.62, 37.77], [41.29, 28.78], [41.01, 28.97]],
    status: 'active'
  },
  {
    id: 'pipe-4',
    name: 'BTC Pipeline',
    type: 'oil',
    points: [[40.41, 49.87], [41.69, 44.83], [36.89, 36.02]],
    status: 'active'
  },
  {
    id: 'pipe-5',
    name: 'Strait of Hormuz Transit',
    type: 'oil',
    points: [[26.60, 56.27], [25.28, 55.30], [24.47, 54.37]],
    status: 'critical chokepoint'
  },
];

// 🖥 AI DATA CENTERS - Major AI compute clusters
export const AI_DATA_CENTERS: InfrastructurePoint[] = [
  // USA
  { id: 'ai-1', name: 'Microsoft Azure (Quincy)', type: 'hyperscale', lat: 47.23, lon: -119.85, country: 'USA', status: 'active', description: '100K+ GPUs' },
  { id: 'ai-2', name: 'Google (The Dalles)', type: 'hyperscale', lat: 45.60, lon: -121.18, country: 'USA', status: 'active' },
  { id: 'ai-3', name: 'Meta AI (Prineville)', type: 'hyperscale', lat: 44.30, lon: -120.83, country: 'USA', status: 'active' },
  { id: 'ai-4', name: 'Oracle/xAI Colossus', type: 'AI', lat: 35.46, lon: -97.51, country: 'USA', status: 'active', description: '100K H100 GPUs' },
  { id: 'ai-5', name: 'CoreWeave NJ', type: 'AI', lat: 40.06, lon: -74.41, country: 'USA', status: 'active' },
  // China
  { id: 'ai-6', name: 'Alibaba (Zhangbei)', type: 'hyperscale', lat: 41.15, lon: 114.70, country: 'China', status: 'active' },
  { id: 'ai-7', name: 'Tencent (Tianjin)', type: 'hyperscale', lat: 39.13, lon: 117.20, country: 'China', status: 'active' },
  { id: 'ai-8', name: 'Baidu AI (Yangquan)', type: 'AI', lat: 37.87, lon: 113.58, country: 'China', status: 'active' },
  // Europe
  { id: 'ai-9', name: 'Google (Hamina)', type: 'hyperscale', lat: 60.57, lon: 27.18, country: 'Finland', status: 'active' },
  { id: 'ai-10', name: 'Microsoft (Dublin)', type: 'hyperscale', lat: 53.35, lon: -6.26, country: 'Ireland', status: 'active' },
  // Middle East
  { id: 'ai-11', name: 'AWS Bahrain', type: 'hyperscale', lat: 26.07, lon: 50.55, country: 'Bahrain', status: 'active' },
  { id: 'ai-12', name: 'G42 (Abu Dhabi)', type: 'AI', lat: 24.47, lon: 54.37, country: 'UAE', status: 'active', description: 'Falcon AI training' },
];

// Layer definitions for map toggle
export const INFRASTRUCTURE_LAYERS = [
  { id: 'spaceports', name: 'Spaceports', icon: '🚀', color: '#8844FF' },
  { id: 'cables', name: 'Undersea Cables', icon: '🔌', color: '#00AAFF' },
  { id: 'pipelines', name: 'Pipelines', icon: '🛢️', color: '#FF8800' },
  { id: 'ai-centers', name: 'AI Data Centers', icon: '🖥️', color: '#00FF88' },
];
