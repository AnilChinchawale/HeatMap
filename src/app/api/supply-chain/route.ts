import { NextResponse } from "next/server";
import {
  MAJOR_PORTS,
  CHOKEPOINTS,
  TRADE_ROUTES,
  PortState,
  ChokepointState,
  SupplyChainAlert,
} from "@/lib/supply-chain";

interface SupplyChainData {
  ports: PortState[];
  chokepoints: ChokepointState[];
  alerts: SupplyChainAlert[];
  routes: Array<typeof TRADE_ROUTES[0] & { status: string }>;
  updatedAt: string;
}

// Simple in-memory cache
let cache: {
  data: SupplyChainData;
  timestamp: number;
} | null = null;

const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours

// Scrape port congestion from MarineTraffic-like sources
async function fetchPortStatus(): Promise<PortState[]> {
  // In production, this would scrape actual port data
  // For now, generate realistic demo data with some random variations
  const statuses = ["normal", "congested", "restricted", "normal", "normal"] as const;
  const waitTimes = [
    "Same day",
    "1-2 days",
    "2-3 days",
    "3-5 days",
    "5+ days",
    "Delayed",
  ];

  return MAJOR_PORTS.map((port) => {
    const status =
      port.name === "Shanghai" || port.name === "Los Angeles"
        ? "congested"
        : port.name === "Dubai (Jebel Ali)"
          ? "restricted"
          : statuses[Math.floor(Math.random() * statuses.length)];

    return {
      name: port.name,
      status: status as PortState["status"],
      waitTime:
        status === "congested"
          ? "2-4 days"
          : status === "restricted"
            ? "1-2 days"
            : waitTimes[Math.floor(Math.random() * waitTimes.length)],
      vesselsAtAnchor: Math.floor(Math.random() * 80) + 5,
      lastUpdated: new Date().toISOString(),
      notes:
        status === "restricted"
          ? "Heightened security checks"
          : status === "congested"
            ? "High volume backlog"
            : undefined,
    };
  });
}

// Scrape chokepoint status
async function fetchChokepointStatus(): Promise<ChokepointState[]> {
  return CHOKEPOINTS.map((cp) => {
    let status: ChokepointState["status"] = "open";
    let delayHours = 0;
    const incidents: string[] = [];

    // Correlate with known conflicts
    if (cp.name === "Strait of Hormuz" || cp.name === "Bab el-Mandeb") {
      status = Math.random() > 0.5 ? "delayed" : "partial";
      delayHours = status === "delayed" ? 24 : 8;
      incidents.push("Military activity in region");
      incidents.push("Heightened security protocols");
    } else if (cp.name === "Suez Canal") {
      status = "open";
      delayHours = 2;
    } else if (cp.name === "Taiwan Strait") {
      status = "partial";
      delayHours = 12;
      incidents.push("Naval exercises reported");
    }

    return {
      name: cp.name,
      status,
      delayHours,
      incidents,
      affectedRoutes: TRADE_ROUTES.filter((r) =>
        r.via.includes(cp.name)
      ).map((r) => r.name),
    };
  });
}

// Generate alerts based on port + chokepoint status
function generateAlerts(
  ports: PortState[],
  chokepoints: ChokepointState[]
): SupplyChainAlert[] {
  const alerts: SupplyChainAlert[] = [];

  // Critical chokepoint alerts
  chokepoints
    .filter((cp) => cp.status === "delayed" || cp.status === "partial")
    .forEach((cp) => {
      alerts.push({
        id: `cp-${cp.name.replace(/\s+/g, "-")}`,
        severity: cp.status === "delayed" ? "critical" : "high",
        title: `${cp.name}: ${cp.status === "delayed" ? "Significant delays" : "Partial restrictions"}`,
        description: `Transit delays of ${cp.delayHours}+ hours. ${cp.incidents.join(". ")}`,
        affectedChokepoints: [cp.name],
        affectedPorts: MAJOR_PORTS.filter((p) =>
          TRADE_ROUTES.some(
            (r) =>
              r.via.includes(cp.name) &&
              (r.from === p.name || r.to === p.name)
          )
        ).map((p) => p.name),
        relatedConflicts: getRelatedConflicts(cp.name),
        timestamp: new Date().toISOString(),
      });
    });

  // Congested port alerts
  ports
    .filter((p) => p.status === "congested" || p.status === "restricted")
    .forEach((p) => {
      alerts.push({
        id: `port-${p.name.replace(/\s+/g, "-")}`,
        severity: p.status === "restricted" ? "high" : "medium",
        title: `${p.name}: ${p.status === "restricted" ? "Operations restricted" : "Port congested"}`,
        description: `Wait time: ${p.waitTime}. ${p.vesselsAtAnchor} vessels at anchor. ${p.notes || ""}`,
        affectedPorts: [p.name],
        affectedChokepoints: TRADE_ROUTES.filter(
          (r) => r.from === p.name || r.to === p.name
        )
          .flatMap((r) => r.via)
          .filter((v, i, a) => a.indexOf(v) === i),
        timestamp: new Date().toISOString(),
      });
    });

  return alerts;
}

// Map chokepoints to active conflict regions
function getRelatedConflicts(chokepointName: string): string[] {
  const conflictMap: Record<string, string[]> = {
    "Strait of Hormuz": ["Iran", "Gaza", "Yemen"],
    "Bab el-Mandeb": ["Yemen", "Gaza", "Sudan"],
    "Suez Canal": ["Gaza", "Sudan"],
    "Taiwan Strait": ["Taiwan"],
  };
  return conflictMap[chokepointName] || [];
}

export async function GET() {
  // Check cache
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=7200" },
    });
  }

  const ports = await fetchPortStatus();
  const chokepoints = await fetchChokepointStatus();
  const alerts = generateAlerts(ports, chokepoints);

  const response = {
    ports,
    chokepoints,
    alerts,
    routes: TRADE_ROUTES.map((r) => ({
      ...r,
      status: getRouteStatus(r, chokepoints),
    })),
    updatedAt: new Date().toISOString(),
  };

  // Update cache
  cache = { data: response, timestamp: Date.now() };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "public, max-age=7200" },
  });
}

function getRouteStatus(
  route: (typeof TRADE_ROUTES)[0],
  chokepoints: ChokepointState[]
) {
  const routeChokepoints = chokepoints.filter((cp) =>
    route.via.includes(cp.name)
  );
  if (routeChokepoints.some((cp) => cp.status === "delayed"))
    return "delayed";
  if (routeChokepoints.some((cp) => cp.status === "partial"))
    return "partial";
  return "normal";
}
