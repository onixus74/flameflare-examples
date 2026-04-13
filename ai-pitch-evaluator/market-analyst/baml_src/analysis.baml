enum MarketTiming {
  Early
  RightTime
  Late
}

enum CompetitionLevel {
  Low
  Moderate
  High
  Saturated
}

class MarketAnalysis {
  tam_estimate string @description("Total addressable market size estimate with reasoning, e.g. '$5B by 2027'")
  competition_level CompetitionLevel @description("How competitive the market is")
  competitors string[] @description("Key competitors identified from the pitch")
  market_timing MarketTiming @description("Whether the timing is right for this product")
  opportunities string[] @description("Market opportunities and tailwinds")
  risks string[] @description("Market risks and headwinds")
  score int @description("Market attractiveness score from 1 to 10")
  summary string @description("2-3 sentence market analysis summary")
}

function AnalyzeMarket(pitch: string) -> MarketAnalysis {
  client GPT4o
  prompt #"
    You are a market research analyst evaluating a startup pitch.
    Focus on total addressable market (TAM), competition landscape,
    market timing, and growth potential.

    Startup Pitch:
    {{ pitch }}

    Provide a thorough market analysis. Be specific about competitors
    and market size estimates where possible.

    {{ ctx.output_format }}
  "#
}