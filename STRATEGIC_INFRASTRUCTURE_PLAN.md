# Strategic Infrastructure & Supply Chain Intelligence — Implementation Plan

**Project:** GlobeNewsLive  
**Feature:** Strategic Infrastructure & Supply Chain Intelligence  
**Scope:** Next intelligence layer after Company Exposure  
**Target:** One working day, visible dashboard improvement, modular under `src/lib/gloomberb`

---

## 1. Architecture

Add a new layer into the existing pipeline:

```
Signal
  ↓
Event Mapping
  ↓
Market Impact
  ↓
Company Exposure
  ↓
Strategic Infrastructure & Supply Chain Intelligence   ← NEW
  ↓
Dashboard (Event Market Intelligence panel + map layers)
```

The new layer is event-driven: it takes the primary geopolitical event selected by `selectPrimaryEvent()` and computes:
- Matched strategic chokepoints
- Affected supply chain corridors (ports, routes, hubs)
- Critical infrastructure nodes (pipelines, cables, data centers, spaceports)
- Composite supply-chain risk score
- Logistics implications summary

It reuses existing datasets instead of duplicating them:
- `src/lib/supply-chain.ts` — ports, chokepoints, trade routes
- `src/lib/trade-routes.ts` — trade hubs, route GeoJSON
- `src/lib/infrastructure.ts` — pipelines, cables, data centers, spaceports
- `src/lib/gloomberb/event-mapping.ts` — existing rule engine and themes

New logic lives in `src/lib/gloomberb/` so it stays aligned with the existing intelligence modules.

---

## 2. Files to Create

### Core engine (new gloomberb module)

1. `src/lib/gloomberb/infrastructure-intelligence.ts`
   - `buildInfrastructureIntelligence(event, options)`
   - `scoreChokepoints(event)`
   - `scorePorts(event)`
   - `scoreTradeRoutes(event)`
   - `scoreInfrastructureNodes(event)`
   - `computeLogisticsImplications(event, chokepoints, ports, routes, infrastructure)`
   - `computeCompositeSupplyChainRisk(...)`

2. `src/lib/gloomberb/supply-chain-mapping.ts`
   - `mapEventToSupplyChainCorridors(event)`
   - `findAffectedPorts(chokepoints)`
   - `findAffectedRoutes(chokepoints, ports)`
   - `findNearbyInfrastructure(event, radiusKm)`
   - `findRelatedPipelines(event)`
   - `findRelatedCables(event)`

3. `src/lib/gloomberb/infrastructure-scoring.ts`
   - `scoreChokepointRisk(chokepoint, event)`
   - `scorePortRisk(port, event)`
   - `scoreRouteRisk(route, chokepoints, event)`
   - `scoreInfrastructureNode(node, event)`
   - `calculateDisruptionProbability(...)`
   - `calculateSeverity(...)`
   - `normalizeScore(score)`

4. `src/lib/gloomberb/extended-types.ts`
   - `InfrastructureNode`
   - `ScoredChokepoint`
   - `ScoredPort`
   - `ScoredTradeRoute`
   - `ScoredInfrastructureNode`
   - `SupplyChainImplication`
   - `InfrastructureIntelligenceData`
   - `LogisticsImplication`

### API routes

5. `src/app/api/finance/impact/infrastructure/route.ts`
   - Dedicated endpoint: `/api/finance/impact/infrastructure`
   - Returns infrastructure/supply-chain intelligence for the current primary event

6. `src/app/api/supply-chain/intelligence/route.ts`
   - Standalone endpoint: `/api/supply-chain/intelligence`
   - Returns per-event scoring for any caller

### UI components

7. `src/components/finance/InfrastructureIntelligencePanel.tsx`
   - Main panel to be embedded in `EventMarketIntelligencePanel`
   - Sections: Chokepoints, Affected Routes, Infrastructure Nodes, Logistics Implications, Composite Risk

8. `src/components/finance/ScoredChokepointList.tsx`
   - Horizontal chip list for scored chokepoints with risk badges

9. `src/components/finance/ScoredRouteList.tsx`
   - Compact list of affected trade routes with status badges

10. `src/components/finance/InfrastructureNodeList.tsx`
    - Collapsible list of infrastructure nodes grouped by type (pipeline, cable, data center, spaceport)

11. `src/components/finance/LogisticsSummary.tsx`
    - 1–2 sentence summary of logistics implications + composite risk gauge

12. `src/components/finance/SupplyChainRiskGauge.tsx`
    - SVG ring gauge for the composite supply-chain risk score

### Type updates

13. `src/types/infrastructure.ts` (new)
    - Shared domain types referenced by both engine and UI

---

## 3. Files to Modify

### Core engine integration

1. `src/lib/gloomberb/types.ts`
   - Append `infrastructureIntelligence?: InfrastructureIntelligenceData` to `EventMarketIntelligenceData`

2. `src/lib/gloomberb/market-impact.ts`
   - Import `buildInfrastructureIntelligence`
   - After `companyImpacts`, call `buildInfrastructureIntelligence(primaryEvent)`
   - Attach result to returned `EventMarketIntelligenceData`

3. `src/lib/gloomberb/event-mapping.ts`
   - Extend existing `EventMappingRule.affectedSymbols` with optional `infrastructure` array:
     - `chokepoints`, `ports`, `pipelines`, `cables`, `dataCenters`, `spaceports`, `tradeRoutes`
   - Add infrastructure-related keywords to existing rules where missing (e.g., "Kharg Island", "Bandar Abbas", "Red Sea cable" for Iran/MENA rules)

### API integration

4. `src/app/api/finance/impact/route.ts`
   - No breaking changes; `buildEventMarketIntelligence` will return the new infrastructure payload automatically
   - Optionally add `?include=infrastructure` query param to skip expensive node scoring

5. `src/app/api/supply-chain/route.ts`
   - Add `eventContext` query param (event title/keywords)
   - When provided, score ports/chokepoints/routes against the event and include `eventRisk` in response

### UI integration

6. `src/components/finance/EventMarketIntelligencePanel.tsx`
   - Add new section after `CompanyExposureList`
   - Render `InfrastructureIntelligencePanel` when `impactData.infrastructureIntelligence` is present
   - Use existing `PanelHeader` styling conventions

7. `src/components/WorldMap.tsx`
   - Add a new map layer toggle "Supply Chain Risk"
   - When active, colorize existing `trade-routes-line` and chokepoint/port sources based on event-driven risk scores
   - Reuse existing sources; add paint-data-driven styling instead of new sources

### Data re-use / small enrichments

8. `src/lib/supply-chain.ts`
   - Add `id` to `MAJOR_PORTS` entries
   - Add `criticality: 'critical' | 'high' | 'medium' | 'low'` to `MAJOR_PORTS` and `CHOKEPOINTS`
   - Add `primaryCommodities?: string[]` to chokepoints (e.g., Hormuz → oil, Malacca → container/electronics)

9. `src/lib/infrastructure.ts`
   - Add `criticality` to `InfrastructurePoint` (already has `risk` but not on all types)
   - Add `commodities?: string[]` to `PIPELINES` entries for energy-corridor matching

10. `src/lib/trade-routes.ts`
    - Add `chokepoints?: string[]` to `TradeRoute` derived from route path
    - Add `commodities?: string[]` to routes (e.g., Asia-Europe Express → container/electronics)

---

## 4. Data Flow

### Full flow through the dashboard

```
User loads /dashboard
  |
  └─ EventMarketIntelligencePanel fetches /api/finance/impact
       |
       └─ /api/finance/impact
            |
            ├─ fetches /api/signals
            ├─ fetches /api/finance
            |
            └─ buildEventMarketIntelligence(signals, financeData, companyQuotes)
                 |
                 ├─ selectPrimaryEvent(signals)
                 ├─ scoreMarketsForEvent(...)           → market impacts
                 ├─ buildCompanyExposure(...)           → company exposures
                 └─ buildInfrastructureIntelligence(...)   ← NEW
                      |
                      ├─ findMatchingRules(event)
                      ├─ mapEventToSupplyChainCorridors(event)
                      │    ├─ match chokepoints by keyword/region
                      │    ├─ resolve affected ports from TRADE_ROUTES
                      │    └─ resolve affected routes from CHOKEPOINTS + ports
                      ├─ scoreChokepoints(...)
                      ├─ scorePorts(...)
                      ├─ scoreTradeRoutes(...)
                      ├─ findNearbyInfrastructure(event, radius)
                      │    ├─ PIPELINES by region/keyword
                      │    ├─ UNDERSEA_CABLES by region/keyword
                      │    ├─ AI_DATA_CENTERS by region/keyword
                      │    └─ SPACEPORTS by region/keyword
                      ├─ scoreInfrastructureNodes(...)
                      ├─ computeLogisticsImplications(...)
                      └─ computeCompositeSupplyChainRisk(...)
                           |
                           └─ returns InfrastructureIntelligenceData
       |
       └─ JSON response includes infrastructureIntelligence field
  |
  └─ EventMarketIntelligencePanel renders new InfrastructureIntelligencePanel section
```

### Independent supply-chain endpoint flow

```
/api/supply-chain/intelligence?event=Iran%20Hormuz&severity=HIGH
  |
  └─ buildInfrastructureIntelligenceFromParams(params)
       |
       └─ returns scored chokepoints, ports, routes, infrastructure, logistics summary
```

---

## 5. API Changes

### `GET /api/finance/impact`

**Response addition:**
```json
{
  "primaryEvent": { ... },
  "marketSummary": "...",
  "impacts": [ ... ],
  "topMarkets": { ... },
  "topCompanies": [ ... ],
  "companyImpacts": [ ... ],
  "infrastructureIntelligence": {          // NEW
    "compositeRisk": 78,
    "riskLevel": "HIGH",
    "summary": "Iran tensions threaten Strait of Hormuz oil transit, raising global energy risk.",
    "chokepoints": [ ... ],
    "ports": [ ... ],
    "tradeRoutes": [ ... ],
    "infrastructureNodes": [ ... ],
    "logisticsImplications": [ ... ]
  }
}
```

Optional query: `?include=infrastructure` (default true) or `?include=infrastructure,markets`.

### `GET /api/supply-chain/intelligence`

New endpoint.

**Query params:**
- `event` — event title/description
- `severity` — CRITICAL | HIGH | MEDIUM | LOW
- `region` — region hint
- `category` — conflict | cyber | infrastructure | ...

**Response shape:**
```json
{
  "event": { "title": "...", "severity": "HIGH", ... },
  "compositeRisk": 78,
  "riskLevel": "HIGH",
  "summary": "...",
  "chokepoints": [...],
  "ports": [...],
  "routes": [...],
  "infrastructureNodes": [...],
  "implications": [...]
}
```

### `GET /api/supply-chain`

**Backward-compatible enhancement:** when `eventContext` query param is present, include:
```json
{
  "ports": [...],
  "chokepoints": [...],
  "alerts": [...],
  "routes": [...],
  "updatedAt": "...",
  "eventRisk": {           // NEW, only when eventContext supplied
    "compositeRisk": 78,
    "affectedChokepoints": [...],
    "affectedRoutes": [...]
  }
}
```

---

## 6. UI Layout

### Placement

Embed the new intelligence directly inside the existing `EventMarketIntelligencePanel`, below `CompanyExposureList`. This satisfies the requirement to build on the existing panel.

### Section structure

```
┌─────────────────────────────────────────────┐
│ EVENT MARKET INTELLIGENCE                   │
├─────────────────────────────────────────────┤
│ [Signal header]                               │
│ [Market summary]                              │
│ [Market impact treemap]                       │
│ [Top affected markets]                        │
│ [Top affected companies]                        │
├─────────────────────────────────────────────┤
│ INFRASTRUCTURE & SUPPLY CHAIN RISK   ← NEW    │
├─────────────────────────────────────────────┤
│ Composite Risk Gauge  [78  HIGH]              │
│ Logistics Summary                             │
│                                             │
│ STRATEGIC CHOKEPOINTS                         │
│ ┌────────┐ ┌────────┐ ┌────────┐           │
│ │ Hormuz │ │ Bab el │ │ Malacca│           │
│ │ 92 CRIT│ │ 84 HIGH│ │ 42 MED │           │
│ └────────┘ └────────┘ └────────┘           │
│                                             │
│ AFFECTED TRADE ROUTES                         │
│ • Asia-Europe Express     delayed           │
│ • Middle East-Europe      delayed           │
│ • Trans-Pacific Eastbound normal            │
│                                             │
│ CRITICAL INFRASTRUCTURE                       │
│ ▸ Pipelines (3)                             │
│ ▸ Undersea Cables (1)                       │
│ ▸ AI Data Centers (2)                       │
│ ▸ Spaceports (1)                            │
│                                             │
│ LOGISTICS IMPLICATIONS                        │
│ • Oil transit disruption: 21M bpd at risk     │
│ • Container delays via Red Sea/Suez           │
│ • Semiconductor corridor: elevated           │
└─────────────────────────────────────────────┘
```

### Components map

- `SupplyChainRiskGauge` — top-left composite score
- `LogisticsSummary` — one-line narrative under gauge
- `ScoredChokepointList` — horizontal chips
- `ScoredRouteList` — vertical list
- `InfrastructureNodeList` — grouped accordion
- `LogisticsImplicationList` — bullet list

### Map integration

WorldMap layer toggle adds:
- **Supply Chain Risk** — recolors existing `trade-routes-line` and highlights chokepoints/ports based on event scores
- No new map sources; uses paint expressions on existing GeoJSON sources

---

## 7. Infrastructure Scoring Engine

### Inputs

- Primary geopolitical event (`GeopoliticalEvent`)
- Existing rules from `event-mapping.ts`
- Existing datasets: `CHOKEPOINTS`, `MAJOR_PORTS`, `TRADE_ROUTES`, `PIPELINES`, `UNDERSEA_CABLES`, `AI_DATA_CENTERS`, `SPACEPORTS`

### Scoring dimensions

Each asset receives a 0–100 risk score based on:

1. **Event rule match** (0–40 points)
   - Does the event match a rule whose `affectedSymbols` includes this asset?
   - Higher base score = higher points

2. **Keyword proximity** (0–25 points)
   - Event title/summary contains asset name, country, or related commodity
   - Multiple keyword matches accumulate

3. **Geographic proximity** (0–20 points)
   - Haversine distance from event lat/lon to asset lat/lon
   - Only computed if event has coordinates; otherwise uses region/category match
   - Closer = higher score

4. **Criticality / baseline risk** (0–15 points)
   - Asset's intrinsic `criticality` or `risk` field
   - `critical` = 15, `high` = 10, `medium` = 6, `low` = 2

5. **Severity multiplier** (0.75–1.5x)
   - CRITICAL 1.5x, HIGH 1.25x, MEDIUM 1.0x, LOW 0.75x

### Formula

```
base = ruleMatch + keywordProximity + geographicProximity + criticality
score = min(100, round(base * severityMultiplier))
```

### Asset-specific overrides

- **Chokepoints:** score is boosted by 10 if event explicitly mentions the chokepoint name
- **Ports:** score is boosted if port is on a route that passes through an affected chokepoint
- **Routes:** score is the max of its chokepoint scores, plus 10 if route commodity keywords match event
- **Infrastructure nodes:** score is max of keyword match, region match, and proximity; pipelines and cables get +10 when energy/telecom keywords present

### Output levels

- 0–39 → Low
- 40–69 → Medium
- 70–84 → High
- 85–100 → Critical

---

## 8. Supply Chain Mapping

### Corridors derived from existing data

| Event theme | Matched chokepoints | Affected routes | Critical infrastructure |
|---|---|---|---|
| Middle East energy | Strait of Hormuz, Bab el-Mandeb, Suez Canal | Middle East-Europe, Asia-Europe Express | Hormuz transit pipeline, Persian Gulf cables, Saudi/ UAE data centers |
| Taiwan/China tech | Taiwan Strait, Strait of Malacca | Trans-Pacific Eastbound, Asia-Americas | Taiwan undersea cables, TSMC-adjacent data centers |
| Red Sea shipping | Bab el-Mandeb, Suez Canal | Asia-Europe Express, Africa-Europe | Red Sea cables, Suez-adjacent pipelines |
| Russia/Ukraine energy | Turkish Straits, GIUK Gap | Europe internal routes | Nord Stream / Druzhba / TurkStream pipelines |

### Mapping functions

- `getChokepointsForEvent(event)` — keyword/region/rule matching against `CHOKEPOINTS`
- `getRoutesForChokepoints(chokepoints)` — filter `TRADE_ROUTES` where `via` intersects
- `getPortsForRoutes(routes)` — distinct `from`/`to` port references from routes
- `getPipelinesForEvent(event)` — keyword + region match against `PIPELINES`
- `getCablesForEvent(event)` — keyword + region match against `UNDERSEA_CABLES`
- `getDataCentersForEvent(event)` — region + tech/AI keyword match
- `getSpaceportsForEvent(event)` — region + launch/missile keyword match

### Reuse rule themes

Existing `EXPOSURE_THEMES` in `company-exposure.ts` already encode themes like:
- `middle-east-energy`
- `strait-transit`
- `shipping-disruption`
- `semiconductor-supply-chain`
- `asia-tech`

These same themes drive supply-chain mapping, so company exposure and infrastructure intelligence stay consistent.

---

## 9. Risk Calculation

### Composite Supply Chain Risk (0–100)

```
chokepointWeight = 0.35
routeWeight      = 0.25
portWeight       = 0.20
infraWeight      = 0.15
logisticsWeight  = 0.05

componentScore(items) = max score of items in category, or 0 if empty

composite =
  chokepointScore * chokepointWeight +
  routeScore      * routeWeight +
  portScore       * portWeight +
  infraScore      * infraWeight +
  logisticsScore  * logisticsWeight
```

Why max-based? A single critical chokepoint (e.g., Hormuz) dominates the global risk picture; averaging would dilute it.

### Disruption probability

For each chokepoint, compute a separate 0–100 **disruption probability**:

```
probability = min(100, score * 0.8 + randomBase(chokepoint.risk))
```

Where `randomBase` is:
- `high` risk chokepoint → +20
- `medium` → +10
- `low` → +0

This is displayed as a sub-metric in the UI.

### Logistics implications

Generate 3–5 implication bullets from templates keyed by affected categories:

- **Oil transit:** "{chokepoint} carries {throughput}; disruption raises global energy risk."
- **Container shipping:** "{route} delays extend Asia-Europe transit times by ~{delayHours} hours."
- **Semiconductors:** "{chokepoint} corridor affects electronics supply chains."
- **Pipelines:** "{pipeline} status is {status}; alternative LNG routes may tighten."
- **Cables:** "{cable} cuts would reroute {capacity} traffic."

Template selection is driven by which asset categories scored above 50.

---

## 10. Verification Steps

### Unit-level engine tests

1. Run a local test input for an Iran/Hormuz event:
   - Expected: Strait of Hormuz score ≥ 90, Middle East-Europe route score ≥ 70, BTC pipeline or Hormuz transit pipeline appears, composite risk ≥ 75
2. Run a Taiwan/TSMC event:
   - Expected: Taiwan Strait score ≥ 85, Trans-Pacific Eastbound route affected, TSMC-related data centers flagged, semiconductor supply-chain implication present
3. Run a Red Sea/Houthi event:
   - Expected: Bab el-Mandeb and Suez Canal score ≥ 80, Asia-Europe Express delayed, Red Sea cable flagged

### API verification

1. `curl /api/finance/impact` and confirm `infrastructureIntelligence` object exists in JSON
2. `curl /api/supply-chain/intelligence?event=Iran+Strait+of+Hormuz&severity=HIGH` and confirm:
   - `compositeRisk` present
   - `chokepoints` non-empty
   - `summary` generated
3. `curl /api/supply-chain?eventContext=Iran+Hormuz` and confirm backward-compatible fields remain + `eventRisk` added

### UI verification

1. Load dashboard; open Event Market Intelligence panel
2. Confirm new "Infrastructure & Supply Chain Risk" section renders below companies
3. Confirm composite gauge, chokepoint chips, route list, infrastructure accordion visible
4. Confirm no layout overflow; panel scrollbar works
5. Toggle WorldMap "Supply Chain Risk" layer; confirm route colors update and chokepoints highlight

### Build verification

1. `npm run build` (or `next build`) passes with no new TypeScript errors
2. `npm run lint` passes
3. No runtime errors in browser console on dashboard load

### Regression checks

1. Existing `/api/supply-chain` consumers still receive original fields unchanged
2. Existing `/api/finance/impact` consumers that ignore new field are unaffected
3. `EventMarketIntelligencePanel` still renders market treemap and company list correctly
4. WorldMap still loads all existing layers when "Supply Chain Risk" is off

---

## Implementation Order (One Day)

| Phase | Time | Tasks |
|---|---|---|
| Morning 1 | 1.5h | Create `src/types/infrastructure.ts`, extend `gloomberb/types.ts`, create `infrastructure-scoring.ts`, enrich `supply-chain.ts` / `infrastructure.ts` / `trade-routes.ts` metadata |
| Morning 2 | 1.5h | Create `supply-chain-mapping.ts` and `infrastructure-intelligence.ts`; wire into `market-impact.ts` |
| Afternoon 1 | 1.5h | Create API routes: `/api/finance/impact/infrastructure` and `/api/supply-chain/intelligence`; update existing routes |
| Afternoon 2 | 2h | Build UI components, integrate into `EventMarketIntelligencePanel`, update `WorldMap` layer styling |
| Wrap-up | 1h | Build, lint, manual verification, regression checks |

---

## Success Criteria

- [ ] `/api/finance/impact` returns `infrastructureIntelligence` for Iran, Taiwan, and Red Sea events
- [ ] Dashboard shows a visible new section with composite risk, chokepoints, routes, and infrastructure nodes
- [ ] WorldMap visualizes supply-chain risk when layer toggle is enabled
- [ ] Build and lint pass
- [ ] No regression in existing panels or APIs
