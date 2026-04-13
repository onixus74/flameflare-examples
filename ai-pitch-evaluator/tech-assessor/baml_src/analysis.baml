enum Feasibility {
  Low
  Moderate
  High
}

enum Scalability {
  Limited
  Adequate
  Excellent
}

enum InnovationLevel {
  Incremental
  Significant
  Breakthrough
}

class TechAssessment {
  feasibility Feasibility @description("How technically feasible the proposed solution is")
  tech_stack_opinion string @description("Opinion on the technology choices and architecture")
  scalability Scalability @description("How well the solution can scale")
  innovation_level InnovationLevel @description("Level of technical innovation")
  technical_risks string[] @description("Technical risks and challenges")
  technical_strengths string[] @description("Technical strengths and advantages")
  score int @description("Technical viability score from 1 to 10")
  summary string @description("2-3 sentence technical assessment summary")
}

function AssessTechnology(pitch: string) -> TechAssessment {
  client GPT4o
  prompt #"
    You are a CTO-level technical assessor evaluating a startup pitch.
    Focus on technical feasibility, architecture choices, scalability,
    innovation level, and engineering risks.

    Startup Pitch:
    {{ pitch }}

    Provide a thorough technical assessment. Consider both current
    feasibility and long-term scalability challenges.

    {{ ctx.output_format }}
  "#
}