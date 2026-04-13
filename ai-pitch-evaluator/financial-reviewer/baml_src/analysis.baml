enum ConcernLevel {
  Low
  Moderate
  High
}

class FinancialReview {
  revenue_model string @description("Type of revenue model identified, e.g. SaaS, marketplace, transaction-based")
  unit_economics string @description("Assessment of unit economics viability")
  burn_rate_concern ConcernLevel @description("Level of concern about burn rate or capital efficiency")
  path_to_profitability string @description("Assessment of the path to profitability")
  strengths string[] @description("Financial strengths of the business model")
  weaknesses string[] @description("Financial weaknesses or red flags")
  score int @description("Financial viability score from 1 to 10")
  summary string @description("2-3 sentence financial review summary")
}

function ReviewFinancials(pitch: string) -> FinancialReview {
  client GPT4o
  prompt #"
    You are a financial analyst evaluating a startup pitch.
    Focus on revenue model, unit economics, burn rate sustainability,
    and path to profitability.

    Startup Pitch:
    {{ pitch }}

    Provide a thorough financial assessment. Be realistic about the
    business model viability and capital efficiency.

    {{ ctx.output_format }}
  "#
}