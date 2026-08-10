flowchart TB
    subgraph DataSources["Existing GlobeNews Data"]
        Signals["/api/signals"]
        Finance["/api/finance"]
        SupplyChain["/lib/supply-chain"]
        TradeRoutes["/lib/trade-routes"]
        Infrastructure["/lib/infrastructure"]
    end

    subgraph Engine["Gloomberb Intelligence Engine"]
        Route["/api/finance/impact"]
        MarketImpact["market-impact.ts"]
        EventMapping["event-mapping.ts"]
        CompanyExposure["company-exposure.ts"]
        CompanyQuotes["company-quotes.ts"]
        InfrastructureScore["infrastructure-scoring.ts"]
        InfrastructureIntel["infrastructure-intelligence.ts"]
        Summary["summary.ts"]
        Treemap["treemap.ts"]
    end

    subgraph UI["Finance Dashboard"]
        Panel["EventMarketIntelligencePanel"]
        TreemapUI["MarketImpactTreemap"]
        MarketsUI["AffectedMarketList"]
        CompaniesUI["CompanyExposureList"]
        InfraUI["InfrastructureRiskSection"]
    end

    Signals --> Route
    Finance --> Route
    Route --> MarketImpact
    MarketImpact --> EventMapping
    EventMapping --> MarketImpact
    MarketImpact --> CompanyExposure
    CompanyExposure --> CompanyQuotes
    CompanyQuotes --> CompanyExposure
    CompanyExposure --> MarketImpact
    MarketImpact --> InfrastructureIntel
    InfrastructureIntel --> InfrastructureScore
    InfrastructureScore --> SupplyChain
    InfrastructureScore --> TradeRoutes
    InfrastructureScore --> Infrastructure
    InfrastructureIntel --> InfrastructureScore
    MarketImpact --> Summary
    MarketImpact --> Treemap
    MarketImpact --> Route
    Route --> Panel
    Panel --> TreemapUI
    Panel --> MarketsUI
    Panel --> CompaniesUI
    Panel --> InfraUI
