enum Decision {
  StrongPass
  Pass
  Consider
  Invest
  StrongInvest
}

class InvestmentVerdict {
  decision Decision @description("Final investment decision")
  confidence int @description("Confidence level from 1 to 10")
  overall_score int @description("Weighted overall score from 1 to 10")
  key_reasons string[] @description("Top 3 reasons for the decision")
  conditions string[] @description("Conditions or concerns to address before investing")
  dissenting_view string? @description("Any contrarian perspective worth noting")
  summary string @description("2-3 sentence executive summary of the investment thesis")
}

function RenderVerdict(pitch: string, market_analysis: string, financial_review: string, tech_assessment: string) -> InvestmentVerdict {
  client GPT4o
  prompt #"
    You are a managing partner at a venture capital firm making the final
    investment decision. You have received analyses from three specialists:
    a market analyst, a financial reviewer, and a technical assessor.

    Weight the analyses as follows:
    - Market opportunity: 35%
    - Financial viability: 35%
    - Technical feasibility: 30%

    A strong market with poor financials should be a "Consider" at best.
    Critical technical risks should cap the decision at "Pass" regardless
    of market and financial attractiveness.

    Startup Pitch:
    {{ pitch }}

    Market Analysis:
    {{ market_analysis }}

    Financial Review:
    {{ financial_review }}

    Technical Assessment:
    {{ tech_assessment }}

    Render your investment verdict.

    {{ ctx.output_format }}
  "#
}