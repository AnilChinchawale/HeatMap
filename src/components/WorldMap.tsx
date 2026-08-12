"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import useSWR from "swr";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Signal, Severity } from "@/types";
import {
  ACTIVE_CONFLICTS,
  STRATEGIC_CHOKEPOINTS,
  MILITARY_BASES,
} from "@/lib/feeds";
import { getSeverityColor } from "@/lib/classify";
import {
  NUCLEAR_SITES,
  SPACEPORTS,
  AI_DATA_CENTERS,
  IRAN_TARGETS,
  UNDERSEA_CABLES,
  PIPELINES,
} from "@/lib/infrastructure";
import {
  TRADE_HUBS,
  TRADE_ROUTES,
  getRoutesGeoJSON,
  getHubsGeoJSON,
  CLUSTER_REGIONS,
} from "@/lib/trade-routes";
import {
  STOCK_EXCHANGES,
  FINANCIAL_CENTERS,
  CENTRAL_BANKS,
  COMMODITY_HUBS,
  GCC_INVESTMENTS,
  INTERNET_DISRUPTIONS,
  WEATHER_ALERTS,
  ECONOMIC_CENTERS,
  SANCTIONS_TARGETS,
  CYBER_THREATS,
  RESILIENCE_INDEX,
  NATURAL_EVENTS,
  DAY_NIGHT_CENTERS,
} from "@/lib/finance-layers";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface Aircraft {
  id: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  heading: number;
  type:
    | "military"
    | "surveillance"
    | "tanker"
    | "transport"
    | "fighter"
    | "drone"
    | "civilian";
  category: string;
  isMilitary: boolean;
}

interface Earthquake {
  id: string;
  magnitude: number;
  place: string;
  lat: number;
  lon: number;
  depth: number;
}

interface WorldMapProps {
  signals?: Signal[];
  activeLayers: string[];
  onLayerToggle: (layer: string) => void;
  earthquakes?: Earthquake[];
  financeMode?: boolean;
  financeLayers?: string[];
  height?: number;
}

const LAYERS = [
  { id: "clusters", name: "Clusters", icon: "🔴", color: "#ff2244" },
  { id: "conflicts", name: "Conflicts", icon: "⚔️", color: "#ff6633" },
  { id: "military", name: "Military", icon: "🎖️", color: "#ffaa00" },
  { id: "chokepoints", name: "Choke", icon: "⚓", color: "#ffcc00" },
  { id: "earthquakes", name: "Quakes", icon: "🌋", color: "#ff4400" },
  { id: "nuclear", name: "Nuclear", icon: "☢️", color: "#ff00ff" },
  { id: "spaceports", name: "Space", icon: "🚀", color: "#00ccff" },
  { id: "ai-centers", name: "AI", icon: "🖥️", color: "#00ff88" },
  { id: "cables", name: "Cables", icon: "🔌", color: "#00aaff" },
  { id: "pipelines", name: "Pipes", icon: "🛢️", color: "#ff8800" },
  { id: "trade-routes", name: "Trade", icon: "🚢", color: "#ffcc00" },
  { id: "ports", name: "Ports", icon: "⚓", color: "#00ccff" },
  { id: "flights", name: "Flights", icon: "✈️", color: "#00ccff" },
  { id: "gps-jamming", name: "GPS", icon: "📡", color: "#ff00ff" },
];

const FINANCE_LAYERS_META = [
  { id: "exchanges", name: "Exchanges", icon: "📈", color: "#00ff88" },
  { id: "centers", name: "Centers", icon: "🏦", color: "#00aaff" },
  { id: "banks", name: "Banks", icon: "🏛️", color: "#ffaa00" },
  { id: "hubs", name: "Hubs", icon: "⚡", color: "#ff8800" },
  { id: "gcc", name: "GCC", icon: "💰", color: "#00ffaa" },
  { id: "cables", name: "Cables", icon: "🔌", color: "#00aaff" },
  { id: "pipelines", name: "Pipes", icon: "🛢️", color: "#ff8800" },
  { id: "internet", name: "Internet", icon: "🔌", color: "#ff2244" },
  { id: "weather", name: "Weather", icon: "🌪️", color: "#ffaa00" },
  { id: "economic", name: "Economic", icon: "🏭", color: "#aa44ff" },
  { id: "sanctions", name: "Sanctions", icon: "🚫", color: "#ff2244" },
  { id: "cyber", name: "Cyber", icon: "💻", color: "#ff00ff" },
  { id: "resilience", name: "Resilience", icon: "🛡️", color: "#00ff88" },
  { id: "natural", name: "Natural", icon: "🌋", color: "#ff6633" },
  { id: "daynight", name: "Day/Night", icon: "🌐", color: "#00ccff" },
  { id: "trade-routes", name: "Trade", icon: "🚢", color: "#ffcc00" },
];

// Flight type colors
const FLIGHT_COLORS: Record<string, string> = {
  surveillance: "#a855f7", // purple
  drone: "#eab308", // yellow
  tanker: "#3b82f6", // blue
  fighter: "#ef4444", // red
  transport: "#06b6d4", // cyan
  military: "#f97316", // orange
  civilian: "#6b7280", // gray
};

// Calculate event clusters by region
function calculateClusters(
  signals: Signal[],
  earthquakes: Earthquake[],
  conflicts: typeof ACTIVE_CONFLICTS,
) {
  const clusters: {
    region: string;
    lat: number;
    lon: number;
    count: number;
    color: string;
  }[] = [];

  // Pre-defined cluster regions with counts
  const regionCounts: Record<
    string,
    { count: number; lat: number; lon: number }
  > = {
    EUROPE: { count: 0, lat: 50, lon: 10 },
    MENA: { count: 0, lat: 30, lon: 35 },
    ASIA: { count: 0, lat: 35, lon: 100 },
    "NORTH AMERICA": { count: 0, lat: 45, lon: -100 },
    "SOUTH AMERICA": { count: 0, lat: -15, lon: -60 },
    AFRICA: { count: 0, lat: 5, lon: 20 },
    OCEANIA: { count: 0, lat: -25, lon: 135 },
  };

  // Count signals by rough region
  signals.forEach((s) => {
    // Use source hints for region
    const text = (s.title + " " + s.source).toLowerCase();
    if (
      text.includes("ukrain") ||
      text.includes("russia") ||
      text.includes("europe") ||
      text.includes("nato")
    ) {
      regionCounts["EUROPE"].count++;
    } else if (
      text.includes("iran") ||
      text.includes("israel") ||
      text.includes("gaza") ||
      text.includes("syria") ||
      text.includes("yemen") ||
      text.includes("iraq") ||
      text.includes("lebanon")
    ) {
      regionCounts["MENA"].count++;
    } else if (
      text.includes("china") ||
      text.includes("taiwan") ||
      text.includes("korea") ||
      text.includes("japan") ||
      text.includes("india") ||
      text.includes("asia")
    ) {
      regionCounts["ASIA"].count++;
    } else if (
      text.includes("us ") ||
      text.includes("america") ||
      text.includes("canada") ||
      text.includes("mexico")
    ) {
      regionCounts["NORTH AMERICA"].count++;
    } else if (
      text.includes("brazil") ||
      text.includes("argentina") ||
      text.includes("venezuela")
    ) {
      regionCounts["SOUTH AMERICA"].count++;
    } else if (
      text.includes("africa") ||
      text.includes("nigeria") ||
      text.includes("sudan") ||
      text.includes("ethiopia")
    ) {
      regionCounts["AFRICA"].count++;
    }
  });

  // Add earthquakes by location
  earthquakes.forEach((eq) => {
    if (eq.lon > -30 && eq.lon < 60 && eq.lat > 35 && eq.lat < 70)
      regionCounts["EUROPE"].count++;
    else if (eq.lon > 20 && eq.lon < 70 && eq.lat > 10 && eq.lat < 45)
      regionCounts["MENA"].count++;
    else if (eq.lon > 60 && eq.lon < 150 && eq.lat > -10 && eq.lat < 55)
      regionCounts["ASIA"].count++;
    else if (eq.lon > -170 && eq.lon < -50 && eq.lat > 15 && eq.lat < 75)
      regionCounts["NORTH AMERICA"].count++;
    else if (eq.lon > -90 && eq.lon < -30 && eq.lat > -60 && eq.lat < 15)
      regionCounts["SOUTH AMERICA"].count++;
    else if (eq.lon > -20 && eq.lon < 55 && eq.lat > -35 && eq.lat < 35)
      regionCounts["AFRICA"].count++;
    else if (eq.lon > 100 && eq.lon < 180 && eq.lat > -50 && eq.lat < -5)
      regionCounts["OCEANIA"].count++;
  });

  // Add conflicts by location
  conflicts.forEach((c) => {
    if (c.lon > -30 && c.lon < 60 && c.lat > 35 && c.lat < 70)
      regionCounts["EUROPE"].count += 5;
    else if (c.lon > 20 && c.lon < 70 && c.lat > 10 && c.lat < 45)
      regionCounts["MENA"].count += 5;
    else if (c.lon > 60 && c.lon < 150 && c.lat > -10 && c.lat < 55)
      regionCounts["ASIA"].count += 5;
    else regionCounts["AFRICA"].count += 3;
  });

  // Convert to array with colors
  Object.entries(regionCounts).forEach(([region, data]) => {
    if (data.count > 0) {
      const color =
        data.count > 50
          ? "#ff0000"
          : data.count > 20
            ? "#ff6600"
            : data.count > 10
              ? "#ffaa00"
              : "#00ff88";
      clusters.push({
        region,
        lat: data.lat,
        lon: data.lon,
        count: data.count,
        color,
      });
    }
  });

  return clusters;
}

export default function WorldMap({
  signals = [],
  activeLayers,
  onLayerToggle,
  earthquakes = [],
  financeMode = false,
  financeLayers = [],
  height,
}: WorldMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const flightMarkersRef = useRef<
    Map<string, { marker: maplibregl.Marker; element: HTMLDivElement }>
  >(new Map());
  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Fetch flight data with real-time updates (5 second refresh for smoother movement)
  const { data: flightData, isLoading: flightsLoading } = useSWR<{
    flights: Aircraft[];
    aircraft: Aircraft[];
    military: number;
  }>(
    activeLayers.includes("flights")
      ? "/api/flights?region=global&military=false"
      : null,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true, revalidateOnMount: true },
  );

  // Support both 'flights' and 'aircraft' keys from API
  const flights = flightData?.flights || flightData?.aircraft || [];

  // Calculate clusters
  const clusters = useMemo(
    () => calculateClusters(signals, earthquakes, ACTIVE_CONFLICTS),
    [signals, earthquakes],
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [30, 25],
      zoom: 2.5,
      minZoom: 1.5,
      maxZoom: 12,
      attributionControl: false,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    // Add timeout for map loading
    const loadTimeout = setTimeout(() => {
      if (!loaded) {
        setMapError("Map style failed to load. Check your internet connection.");
        setLoaded(true); // Show content anyway
      }
    }, 10000);

    map.current.on("error", (e) => {
      console.error("Map error:", e);
      setMapError("Failed to load map tiles. Check your internet connection.");
      clearTimeout(loadTimeout);
      setLoaded(true);
    });

    map.current.on("load", () => {
      clearTimeout(loadTimeout);
      setLoaded(true);

      // Add trade routes source and layer
      if (map.current) {
        // Routes layer
        map.current.addSource("trade-routes", {
          type: "geojson",
          data: getRoutesGeoJSON() as any,
        });

        map.current.addLayer({
          id: "trade-routes-line",
          type: "line",
          source: "trade-routes",
          paint: {
            "line-color": [
              "case",
              ["==", ["get", "risk"], "critical"],
              "#ff4444",
              ["==", ["get", "risk"], "high"],
              "#ff8800",
              ["==", ["get", "active"], false],
              "#444444",
              "#00d4ff",
            ],
            "line-width": [
              "interpolate",
              ["linear"],
              ["get", "volume"],
              20,
              0.5,
              50,
              1,
              80,
              1.5,
              100,
              2,
            ],
            "line-opacity": [
              "case",
              ["==", ["get", "active"], false],
              0.3,
              0.6,
            ],
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
            visibility: "none", // Start hidden
          },
        });

        // Trade hubs source
        map.current.addSource("trade-hubs", {
          type: "geojson",
          data: getHubsGeoJSON() as any,
        });

        map.current.addLayer({
          id: "trade-hubs-circle",
          type: "circle",
          source: "trade-hubs",
          paint: {
            "circle-radius": [
              "case",
              ["==", ["get", "type"], "major"],
              6,
              ["==", ["get", "type"], "regional"],
              4,
              3,
            ],
            "circle-color": "#00d4ff",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
            "circle-opacity": 0.8,
          },
          layout: {
            visibility: "none",
          },
        });

        // Hub labels
        map.current.addLayer({
          id: "trade-hubs-label",
          type: "symbol",
          source: "trade-hubs",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Regular"],
            "text-size": 9,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            visibility: "none",
          },
          paint: {
            "text-color": "#ffffff",
            "text-halo-color": "#000000",
            "text-halo-width": 1,
          },
        });
      }
    });

    return () => {
      // Clean up flight markers before removing map
      if (flightMarkersRef.current instanceof Map) {
        flightMarkersRef.current.forEach(({ marker }) => marker.remove());
        flightMarkersRef.current.clear();
      }
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Toggle trade routes visibility
  useEffect(() => {
    if (!map.current || !loaded) return;

    const visibility = activeLayers.includes("routes") ? "visible" : "none";

    try {
      map.current.setLayoutProperty(
        "trade-routes-line",
        "visibility",
        visibility,
      );
      map.current.setLayoutProperty(
        "trade-hubs-circle",
        "visibility",
        visibility,
      );
      map.current.setLayoutProperty(
        "trade-hubs-label",
        "visibility",
        visibility,
      );
    } catch (e) {
      // Layer might not exist yet
    }
  }, [activeLayers, loaded]);

  // Update flight markers with smooth animation (real-time updates)
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Ensure flightMarkersRef is a Map
    if (!(flightMarkersRef.current instanceof Map)) {
      flightMarkersRef.current = new Map();
    }

    if (!activeLayers.includes("flights")) {
      // Clear all flight markers if layer is disabled
      flightMarkersRef.current.forEach(({ marker }) => marker.remove());
      flightMarkersRef.current.clear();
      return;
    }

    if (flights.length === 0) return;

    const currentFlightIds = new Set(flights.map((f) => f.id));
    const existingIds = new Set(flightMarkersRef.current.keys());

    // Remove markers for aircraft no longer in data
    existingIds.forEach((id) => {
      if (!currentFlightIds.has(id)) {
        const entry = flightMarkersRef.current.get(id);
        if (entry) {
          entry.marker.remove();
          flightMarkersRef.current.delete(id);
        }
      }
    });

    // Update or create markers for each flight
    flights.forEach((flight) => {
      const color = FLIGHT_COLORS[flight.type] || FLIGHT_COLORS.civilian;
      const isISR = ["surveillance", "drone"].includes(flight.type);
      const existing = flightMarkersRef.current.get(flight.id);

      if (existing) {
        // Update existing marker with smooth transition
        const { marker, element } = existing;

        // Smoothly animate to new position
        marker.setLngLat([flight.lon, flight.lat]);

        // Update rotation and styling
        element.style.transform = `rotate(${flight.heading}deg)`;
        element.style.fontSize = isISR ? "18px" : "14px";
        element.style.filter = `drop-shadow(0 0 4px ${color})`;
        element.title = `${flight.callsign} • ${flight.category}`;

        // Update popup content
        const popup = marker.getPopup();
        if (popup) {
          popup.setHTML(`
            <div class="text-white min-w-[180px]">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-lg">${flight.type === "surveillance" ? "🔍" : flight.type === "drone" ? "🤖" : flight.type === "tanker" ? "⛽" : flight.type === "fighter" ? "🎯" : "✈️"}</span>
                <strong style="color: ${color}">${flight.callsign}</strong>
              </div>
              <div class="text-[10px] space-y-0.5">
                <div>Type: <span class="text-cyan-400">${flight.category}</span></div>
                <div>Alt: <span class="text-yellow-400">${flight.altitude.toLocaleString()} ft</span></div>
                <div>Speed: <span class="text-green-400">${flight.speed} kts</span></div>
                <div>Heading: ${flight.heading}°</div>
                <div>Country: ${flight.country}</div>
              </div>
            </div>
          `);
        }
      } else {
        // Create new marker for new aircraft
        const el = document.createElement("div");
        el.className = "cursor-pointer hover:scale-125";
        el.style.cssText = `
          font-size: ${isISR ? "18px" : "14px"};
          transform: rotate(${flight.heading}deg);
          filter: drop-shadow(0 0 4px ${color});
          ${isISR ? "animation: pulse 2s infinite;" : ""}
          transition: transform 0.3s ease-out, font-size 0.3s ease;
        `;
        el.textContent = "✈️";
        el.title = `${flight.callsign} • ${flight.category}`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([flight.lon, flight.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`
              <div class="text-white min-w-[180px]">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-lg">${flight.type === "surveillance" ? "🔍" : flight.type === "drone" ? "🤖" : flight.type === "tanker" ? "⛽" : flight.type === "fighter" ? "🎯" : "✈️"}</span>
                  <strong style="color: ${color}">${flight.callsign}</strong>
                </div>
                <div class="text-[10px] space-y-0.5">
                  <div>Type: <span class="text-cyan-400">${flight.category}</span></div>
                  <div>Alt: <span class="text-yellow-400">${flight.altitude.toLocaleString()} ft</span></div>
                  <div>Speed: <span class="text-green-400">${flight.speed} kts</span></div>
                  <div>Heading: ${flight.heading}°</div>
                  <div>Country: ${flight.country}</div>
                </div>
              </div>
            `),
          )
          .addTo(map.current!);

        flightMarkersRef.current.set(flight.id, { marker, element: el });
      }
    });
  }, [flights, activeLayers, loaded]);

  // Update markers when data or layers change
  useEffect(() => {
    if (!map.current || !loaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Add cluster markers
    if (activeLayers.includes("clusters")) {
      clusters.forEach((cluster) => {
        const el = document.createElement("div");
        el.className =
          "flex items-center justify-center cursor-pointer transition-transform hover:scale-110";
        el.style.cssText = `
          width: ${Math.min(50, 24 + cluster.count * 0.3)}px;
          height: ${Math.min(50, 24 + cluster.count * 0.3)}px;
          background: ${cluster.color}33;
          border: 2px solid ${cluster.color};
          border-radius: 50%;
          font-size: 11px;
          font-weight: bold;
          color: white;
          text-shadow: 0 0 4px black;
        `;
        el.textContent = String(cluster.count);
        el.title = `${cluster.region}: ${cluster.count} events`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cluster.lon, cluster.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>${cluster.region}</strong><br/>
              <span class="text-xs">${cluster.count} active events</span></div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add conflict markers
    if (activeLayers.includes("conflicts")) {
      ACTIVE_CONFLICTS.forEach((conflict) => {
        const color = conflict.intensity === "high" ? "#ff2244" : "#ff6633";
        const el = createMarkerElement("⚔️", color, conflict.name);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([conflict.lon, conflict.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>${conflict.name}</strong><br/>
              <span class="text-xs">${conflict.type} • ${conflict.intensity} intensity</span></div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add military base markers
    if (activeLayers.includes("military")) {
      MILITARY_BASES.slice(0, 10).forEach((base) => {
        const el = createMarkerElement("🎖️", "#ff6633", base.name, 0.7);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([base.lon, base.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>${base.name}</strong><br/>
              <span class="text-xs">${base.op} • ${base.type}</span></div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add chokepoint markers
    if (activeLayers.includes("chokepoints")) {
      STRATEGIC_CHOKEPOINTS.forEach((cp) => {
        const el = createMarkerElement("⚓", "#ffaa00", cp.name, 0.8);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cp.lon, cp.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>${cp.name}</strong><br/>
              <span class="text-xs">${cp.oilMbpd ? `${cp.oilMbpd}M bpd oil` : `${cp.tradePct}% global trade`}</span></div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add earthquake markers
    if (activeLayers.includes("earthquakes")) {
      earthquakes.forEach((eq) => {
        const color =
          eq.magnitude >= 6
            ? "#ff2244"
            : eq.magnitude >= 5
              ? "#ff6633"
              : "#aa66ff";
        const size = Math.min(1.2, 0.6 + (eq.magnitude - 4) * 0.15);
        const el = createMarkerElement(
          "🌍",
          color,
          `M${eq.magnitude} ${eq.place}`,
          size,
        );

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([eq.lon, eq.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>M${eq.magnitude.toFixed(1)}</strong><br/>
              <span class="text-xs">${eq.place}</span><br/>
              <span class="text-xs">Depth: ${eq.depth.toFixed(0)}km</span></div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add nuclear site markers
    if (activeLayers.includes("nuclear")) {
      NUCLEAR_SITES.forEach((site) => {
        const color =
          site.risk === "critical"
            ? "#ff0000"
            : site.risk === "high"
              ? "#ff4444"
              : "#ffaa00";
        const el = createMarkerElement("☢️", color, site.name, 0.9);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([site.lon, site.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>☢️ ${site.name}</strong><br/>
              <span class="text-xs">${site.type} • ${site.country}</span>
              ${site.description ? `<br/><span class="text-xs text-gray-400">${site.description}</span>` : ""}</div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add spaceport markers
    if (activeLayers.includes("spaceports")) {
      SPACEPORTS.forEach((port) => {
        const color =
          port.risk === "critical"
            ? "#ff0000"
            : port.risk === "high"
              ? "#ff6633"
              : "#8844ff";
        const el = createMarkerElement("🚀", color, port.name, 0.9);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([port.lon, port.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>🚀 ${port.name}</strong><br/>
              <span class="text-xs">${port.type} • ${port.country}</span></div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add Iran targets
    if (activeLayers.includes("iran")) {
      IRAN_TARGETS.forEach((target) => {
        const color =
          target.risk === "critical"
            ? "#ff0000"
            : target.risk === "high"
              ? "#ff4444"
              : "#ff8800";
        const icon =
          target.type === "nuclear"
            ? "☢️"
            : target.type === "missile"
              ? "🚀"
              : target.type === "airbase"
                ? "✈️"
                : "🎯";
        const el = createMarkerElement(icon, color, target.name, 1.0);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([target.lon, target.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>${icon} ${target.name}</strong><br/>
              <span class="text-xs">${target.type} • ${target.risk?.toUpperCase() || "UNKNOWN"} risk</span>
              ${target.description ? `<br/><span class="text-xs text-gray-400">${target.description}</span>` : ""}</div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Add AI Data Centers
    if (activeLayers.includes("ai-centers")) {
      AI_DATA_CENTERS.forEach((dc) => {
        const el = createMarkerElement("🖥️", "#00ff88", dc.name, 0.8);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([dc.lon, dc.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>🖥️ ${dc.name}</strong><br/>
              <span class="text-xs">${dc.type} • ${dc.country}</span>
              ${dc.description ? `<br/><span class="text-xs text-gray-400">${dc.description}</span>` : ""}</div>`),
          )
          .addTo(map.current!);

        markersRef.current.push(marker);
      });
    }

    // Undersea cables
    if (activeLayers.includes("cables")) {
      UNDERSEA_CABLES.forEach((cable) => {
        [cable.points[0], cable.points[cable.points.length - 1]].forEach(
          (pt, i) => {
            const el = createMarkerElement("🔌", "#00aaff", cable.name, 0.7);
            const marker = new maplibregl.Marker({ element: el })
              .setLngLat([pt[1], pt[0]])
              .setPopup(
                new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                  .setHTML(`<div class="text-white"><strong>🔌 ${cable.name}</strong><br/>
                <span class="text-xs">${cable.capacity}</span><br/>
                <span class="text-xs text-gray-400">${cable.owners}</span></div>`),
              )
              .addTo(map.current!);
            markersRef.current.push(marker);
          },
        );
      });
    }

    // Pipelines
    if (activeLayers.includes("pipelines")) {
      PIPELINES.forEach((pipe) => {
        pipe.points.forEach((pt, i) => {
          if (i === 0 || i === pipe.points.length - 1) {
            const color =
              pipe.status === "sabotaged"
                ? "#ff0000"
                : pipe.status === "critical chokepoint"
                  ? "#ffaa00"
                  : "#ff8800";
            const el = createMarkerElement("🛢️", color, pipe.name, 0.7);
            const marker = new maplibregl.Marker({ element: el })
              .setLngLat([pt[1], pt[0]])
              .setPopup(
                new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                  .setHTML(`<div class="text-white"><strong>🛢️ ${pipe.name}</strong><br/>
                  <span class="text-xs">${pipe.type} • ${pipe.status}</span></div>`),
              )
              .addTo(map.current!);
            markersRef.current.push(marker);
          }
        });
      });
    }

    // Strategic Ports
    if (activeLayers.includes("ports")) {
      const STRATEGIC_PORTS = [
        {
          name: "Port of Shanghai",
          lat: 31.2,
          lon: 121.5,
          throughput: "47M TEU",
          importance: "critical",
        },
        {
          name: "Port of Singapore",
          lat: 1.26,
          lon: 103.82,
          throughput: "37M TEU",
          importance: "critical",
        },
        {
          name: "Port of Rotterdam",
          lat: 51.95,
          lon: 4.13,
          throughput: "15M TEU",
          importance: "high",
        },
        {
          name: "Port of Dubai (Jebel Ali)",
          lat: 24.98,
          lon: 55.06,
          throughput: "14M TEU",
          importance: "high",
        },
        {
          name: "Port of Busan",
          lat: 35.1,
          lon: 129.07,
          throughput: "22M TEU",
          importance: "high",
        },
        {
          name: "Port of Los Angeles",
          lat: 33.74,
          lon: -118.27,
          throughput: "10M TEU",
          importance: "high",
        },
        {
          name: "Port of Hamburg",
          lat: 53.54,
          lon: 9.98,
          throughput: "8M TEU",
          importance: "medium",
        },
        {
          name: "Port of Hormuz (Bandar Abbas)",
          lat: 27.18,
          lon: 56.27,
          throughput: "Chokepoint",
          importance: "critical",
        },
        {
          name: "Strait of Malacca (Port Klang)",
          lat: 2.99,
          lon: 101.38,
          throughput: "Chokepoint",
          importance: "critical",
        },
        {
          name: "Suez Canal (Port Said)",
          lat: 31.26,
          lon: 32.31,
          throughput: "Chokepoint",
          importance: "critical",
        },
        {
          name: "Port of Aden",
          lat: 12.78,
          lon: 45.03,
          throughput: "Contested",
          importance: "high",
        },
        {
          name: "Port of Haifa",
          lat: 32.82,
          lon: 34.99,
          throughput: "1.4M TEU",
          importance: "high",
        },
        {
          name: "Port of Novorossiysk",
          lat: 44.72,
          lon: 37.77,
          throughput: "Sanctioned",
          importance: "medium",
        },
        {
          name: "Port of Vladivostok",
          lat: 43.11,
          lon: 131.88,
          throughput: "1.5M TEU",
          importance: "medium",
        },
        {
          name: "Port of Istanbul (Bosphorus)",
          lat: 41.01,
          lon: 29.01,
          throughput: "Chokepoint",
          importance: "critical",
        },
      ];
      STRATEGIC_PORTS.forEach((port) => {
        const color =
          port.importance === "critical"
            ? "#00ccff"
            : port.importance === "high"
              ? "#ffaa00"
              : "#00ff88";
        const el = createMarkerElement(
          "⚓",
          color,
          port.name,
          port.importance === "critical" ? 1.0 : 0.8,
        );
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([port.lon, port.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`<div class="text-white"><strong>⚓ ${port.name}</strong><br/>
              <span class="text-xs text-cyan-400">${port.throughput}</span><br/>
              <span class="text-xs" style="color:${color}">${port.importance.toUpperCase()}</span></div>`),
          )
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
    }

    // Enhanced Trade Routes
    if (activeLayers.includes("trade-routes")) {
      const MAJOR_ROUTES = [
        {
          name: "Asia-Europe (Suez)",
          points: [
            [31.2, 121.5],
            [1.26, 103.82],
            [27.18, 56.27],
            [31.26, 32.31],
            [51.95, 4.13],
          ],
          color: "#ffcc00",
        },
        {
          name: "Trans-Pacific",
          points: [
            [35.1, 129.07],
            [33.74, -118.27],
          ],
          color: "#00ccff",
        },
        {
          name: "Trans-Atlantic",
          points: [
            [51.95, 4.13],
            [40.67, -74.04],
          ],
          color: "#00ff88",
        },
        {
          name: "Cape of Good Hope",
          points: [
            [31.2, 121.5],
            [-33.9, 18.42],
            [51.95, 4.13],
          ],
          color: "#ff8800",
        },
        {
          name: "Northern Sea Route",
          points: [
            [59.94, 30.32],
            [64.54, 40.52],
            [69.65, 18.96],
            [77.53, 23.6],
            [82.5, 55.0],
          ],
          color: "#aa44ff",
        },
      ];
      MAJOR_ROUTES.forEach((route) => {
        if (!map.current) return;
        const sourceId = `trade-route-${route.name.replace(/\s/g, "-")}`;
        if (!map.current.getSource(sourceId)) {
          map.current.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: { name: route.name },
              geometry: {
                type: "LineString",
                coordinates: route.points.map(([lat, lon]) => [lon, lat]),
              },
            },
          });
          map.current.addLayer({
            id: `trade-route-line-${route.name.replace(/\s/g, "-")}`,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": route.color,
              "line-width": 1.5,
              "line-opacity": 0.5,
              "line-dasharray": [4, 4],
            },
          });
        }
      });
    }

    // FINANCE MODE LAYERS — emoji markers (original style)
    if (financeMode) {
      if (financeLayers.includes("exchanges")) {
        STOCK_EXCHANGES.forEach((ex) => {
          const el = createMarkerElement("📈", "#00ff88", ex.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([ex.lon, ex.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>📈 ${ex.name}</strong><br/>
                <span class="text-xs">${ex.country} • ${ex.type}</span><br/>
                <span class="text-xs text-gray-400">${ex.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("centers")) {
        FINANCIAL_CENTERS.forEach((fc) => {
          const el = createMarkerElement("🏦", "#00aaff", fc.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([fc.lon, fc.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🏦 ${fc.name}</strong><br/>
                <span class="text-xs">${fc.country} • ${fc.type}</span><br/>
                <span class="text-xs text-gray-400">${fc.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("banks")) {
        CENTRAL_BANKS.forEach((bank) => {
          const el = createMarkerElement("🏛️", "#ffaa00", bank.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([bank.lon, bank.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🏛️ ${bank.name}</strong><br/>
                <span class="text-xs">${bank.country} • ${bank.type}</span><br/>
                <span class="text-xs text-gray-400">${bank.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("hubs")) {
        COMMODITY_HUBS.forEach((hub) => {
          const el = createMarkerElement("⚡", "#ff8800", hub.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([hub.lon, hub.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>⚡ ${hub.name}</strong><br/>
                <span class="text-xs">${hub.country} • ${hub.type}</span><br/>
                <span class="text-xs text-gray-400">${hub.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("gcc")) {
        GCC_INVESTMENTS.forEach((gcc) => {
          const el = createMarkerElement("💰", "#00ffaa", gcc.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([gcc.lon, gcc.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>💰 ${gcc.name}</strong><br/>
                <span class="text-xs">${gcc.country} • ${gcc.type}</span><br/>
                <span class="text-xs text-gray-400">${gcc.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("internet")) {
        INTERNET_DISRUPTIONS.forEach((net) => {
          const color = net.status === "active" ? "#ff2244" : "#ffaa00";
          const el = createMarkerElement("🔌", color, net.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([net.lon, net.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🔌 ${net.name}</strong><br/>
                <span class="text-xs">${net.country} • ${net.type}</span><br/>
                <span class="text-xs text-gray-400">${net.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("weather")) {
        WEATHER_ALERTS.forEach((w) => {
          const color = w.status === "warning" ? "#ffaa00" : "#00aaff";
          const el = createMarkerElement("🌪️", color, w.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([w.lon, w.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🌪️ ${w.name}</strong><br/>
                <span class="text-xs">${w.country} • ${w.type}</span><br/>
                <span class="text-xs text-gray-400">${w.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("economic")) {
        ECONOMIC_CENTERS.forEach((ec) => {
          const el = createMarkerElement("🏭", "#aa44ff", ec.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([ec.lon, ec.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🏭 ${ec.name}</strong><br/>
                <span class="text-xs">${ec.country} • ${ec.type}</span><br/>
                <span class="text-xs text-gray-400">${ec.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("sanctions")) {
        SANCTIONS_TARGETS.forEach((st) => {
          const el = createMarkerElement("🚫", "#ff2244", st.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([st.lon, st.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🚫 ${st.name}</strong><br/>
                <span class="text-xs">${st.country} • ${st.type}</span><br/>
                <span class="text-xs text-gray-400">${st.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("cyber")) {
        CYBER_THREATS.forEach((ct) => {
          const color = ct.status === "active" ? "#ff00ff" : "#aa44ff";
          const el = createMarkerElement("💻", color, ct.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([ct.lon, ct.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>💻 ${ct.name}</strong><br/>
                <span class="text-xs">${ct.country} • ${ct.type}</span><br/>
                <span class="text-xs text-gray-400">${ct.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("resilience")) {
        RESILIENCE_INDEX.forEach((ri) => {
          const color = ri.description?.includes("HIGH") ? "#00ff88" : ri.description?.includes("MEDIUM") ? "#ffaa00" : "#ff2244";
          const el = createMarkerElement("🛡️", color, ri.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([ri.lon, ri.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🛡️ ${ri.name}</strong><br/>
                <span class="text-xs">${ri.country} • ${ri.type}</span><br/>
                <span class="text-xs text-gray-400">${ri.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("natural")) {
        NATURAL_EVENTS.forEach((ne) => {
          const el = createMarkerElement("🌋", "#ff6633", ne.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([ne.lon, ne.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🌋 ${ne.name}</strong><br/>
                <span class="text-xs">${ne.country} • ${ne.type}</span><br/>
                <span class="text-xs text-gray-400">${ne.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }

      if (financeLayers.includes("daynight")) {
        DAY_NIGHT_CENTERS.forEach((dn) => {
          const el = createMarkerElement("🌐", "#00ccff", dn.name, 0.8);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([dn.lon, dn.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25, className: "dark-popup" })
                .setHTML(`<div class="text-white"><strong>🌐 ${dn.name}</strong><br/>
                <span class="text-xs">${dn.country} • ${dn.type}</span><br/>
                <span class="text-xs text-gray-400">${dn.description}</span></div>`),
            )
            .addTo(map.current!);
          markersRef.current.push(marker);
        });
      }
    }

    // GPS Jamming zones
    if (activeLayers.includes("gps-jamming")) {
      const GPS_JAMMING_ZONES = [
        {
          name: "Eastern Mediterranean",
          lat: 35.5,
          lon: 34.5,
          radiusKm: 220,
          severity: "critical",
          source: "Russia/Syria",
          description:
            "Persistent GPS/GNSS jamming from Russian forces in Syria. Affects civilian aviation.",
        },
        {
          name: "Baltic Sea (Kaliningrad)",
          lat: 54.7,
          lon: 20.5,
          radiusKm: 180,
          severity: "high",
          source: "Russia",
          description:
            "Kaliningrad-origin jamming affecting Finnish, Baltic and Scandinavian airspace.",
        },
        {
          name: "Black Sea Region",
          lat: 44.5,
          lon: 34.0,
          radiusKm: 150,
          severity: "high",
          source: "Russia",
          description:
            "Active jamming correlates with military ops in Ukraine.",
        },
        {
          name: "Northern Finland/Norway",
          lat: 68.5,
          lon: 27.0,
          radiusKm: 120,
          severity: "medium",
          source: "Russia",
          description:
            "Kola Peninsula area. Interference with Arctic navigation systems.",
        },
        {
          name: "Persian Gulf",
          lat: 26.5,
          lon: 52.0,
          radiusKm: 100,
          severity: "medium",
          source: "Iran",
          description:
            "Spoofing incidents near Strait of Hormuz. Multiple vessel diversions.",
        },
        {
          name: "South Korea (Seoul area)",
          lat: 37.5,
          lon: 126.5,
          radiusKm: 80,
          severity: "medium",
          source: "North Korea",
          description:
            "NK spoofing campaigns targeting aviation and maritime navigation.",
        },
        {
          name: "Gaza/Israel",
          lat: 31.8,
          lon: 34.5,
          radiusKm: 90,
          severity: "critical",
          source: "IDF/Unknown",
          description:
            "Widespread GPS denial. Affects entire Levant. Civilian aviation rerouting.",
        },
        {
          name: "Donbas/Eastern Ukraine",
          lat: 48.5,
          lon: 37.5,
          radiusKm: 130,
          severity: "critical",
          source: "Russia",
          description:
            "Combat theater jamming. All navigation systems degraded.",
        },
        {
          name: "Red Sea (Houthi Zone)",
          lat: 14.0,
          lon: 42.5,
          radiusKm: 110,
          severity: "high",
          source: "Houthis/Iran",
          description:
            "Ship navigation interference. Spoofing linked to drone attack guidance.",
        },
        {
          name: "Taiwan Strait",
          lat: 24.0,
          lon: 119.5,
          radiusKm: 100,
          severity: "medium",
          source: "China/PLA",
          description: "PLA exercises. GPS unreliable during tension periods.",
        },
      ];

      const JAMMING_COLORS: Record<string, string> = {
        critical: "#ff00ff",
        high: "#ff44ff",
        medium: "#aa44ff",
      };

      GPS_JAMMING_ZONES.forEach((zone, idx) => {
        const color = JAMMING_COLORS[zone.severity] || "#ff44ff";
        // Add pulsing circle indicator
        const el = document.createElement("div");
        el.className = "relative cursor-pointer";
        el.style.cssText = `width: 0; height: 0; position: relative;`;

        // Create inner element
        const inner = document.createElement("div");
        inner.style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${color}30;
          border: 1.5px solid ${color};
          position: absolute;
          transform: translate(-50%, -50%);
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          box-shadow: 0 0 8px ${color}60;
        `;
        const label = document.createElement("div");
        label.style.cssText = `
          position: absolute;
          transform: translate(-50%, -160%);
          font-size: 9px;
          font-family: monospace;
          color: ${color};
          white-space: nowrap;
          background: rgba(10,10,15,0.8);
          padding: 1px 4px;
          border-radius: 2px;
          border: 1px solid ${color}40;
          pointer-events: none;
        `;
        label.textContent = `📡 ${zone.severity.toUpperCase()}`;
        el.appendChild(inner);
        el.appendChild(label);

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([zone.lon, zone.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, className: "dark-popup" })
              .setHTML(`
              <div class="text-white min-w-[200px]">
                <div class="flex items-center gap-2 mb-1">
                  <span style="color:${color}">📡</span>
                  <strong style="color:${color}">GPS JAMMING</strong>
                </div>
                <div class="font-bold text-sm mb-1">${zone.name}</div>
                <div class="text-[10px] space-y-1">
                  <div>Radius: <span style="color:${color}">${zone.radiusKm}km</span></div>
                  <div>Severity: <span style="color:${color}">${zone.severity.toUpperCase()}</span></div>
                  <div>Source: <span class="text-yellow-400">${zone.source}</span></div>
                  <div class="text-gray-300 mt-1">${zone.description}</div>
                </div>
              </div>
            `),
          )
          .addTo(map.current!);
        markersRef.current.push(marker);
      });
    }
  }, [signals, activeLayers, loaded, earthquakes, clusters, financeMode, financeLayers]);

  return (
    <div className="glass-panel h-full flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle bg-panel/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🗺️</span>
          <span className="font-mono text-[11px] font-bold tracking-wider text-white">
            WORLD MAP
          </span>
          <span className="text-[9px] text-text-dim font-mono">
            {financeMode
              ? `${financeLayers?.length || 0} layers`
              : `${LAYERS.filter((l) => activeLayers.includes(l.id)).length} layers`}
          </span>
          {activeLayers.includes("flights") && flights.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono animate-pulse">
              ✈️ {flights.length}
            </span>
          )}
        </div>
      </div>

      {/* Map container */}
      <div ref={mapContainer} className="flex-1 min-h-[300px]" />

      {/* Loading overlay */}
      {!loaded && !mapError && (
        <div className="absolute inset-0 bg-[#0a1628] flex flex-col items-center justify-center z-20">
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'linear-gradient(rgba(0,255,136,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.1) 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
          <div className="w-2 h-2 bg-accent-green rounded-full animate-pulse mb-3" />
          <span className="text-[10px] text-white font-mono">Loading map data...</span>
          <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-accent-green animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {/* Error overlay */}
      {mapError && (
        <div className="absolute inset-0 bg-[#0a1628] flex flex-col items-center justify-center z-20">
          <span className="text-2xl mb-2">⚠️</span>
          <span className="text-[11px] text-red-400 font-mono mb-1">Map Error</span>
          <span className="text-[9px] text-gray-400 text-center max-w-[200px]">{mapError}</span>
          <button 
            onClick={() => window.location.reload()}
            className="mt-3 px-3 py-1 rounded text-[9px] font-mono bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition"
          >
            Reload Page
          </button>
        </div>
      )}



      {/* Cluster stats overlay (when clusters enabled) */}
      {activeLayers.includes("clusters") && clusters.length > 0 && (
        <div className="absolute top-14 left-2 bg-void/90 backdrop-blur-sm rounded p-2 text-[9px] z-10">
          <div className="text-text-muted font-mono mb-1">EVENT CLUSTERS</div>
          {clusters.slice(0, 5).map((c) => (
            <div
              key={c.region}
              className="flex items-center justify-between gap-3"
            >
              <span className="text-text-muted">{c.region}</span>
              <span className="font-mono" style={{ color: c.color }}>
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to create marker elements
function createMarkerElement(
  emoji: string,
  color: string,
  title: string,
  scale = 1,
): HTMLElement {
  const el = document.createElement("div");
  el.className = "cursor-pointer transition-transform hover:scale-125";
  el.style.cssText = `
    font-size: ${14 * scale}px;
    filter: drop-shadow(0 0 4px ${color});
    transform: scale(${scale});
  `;
  el.textContent = emoji;
  el.title = title;
  return el;
}

