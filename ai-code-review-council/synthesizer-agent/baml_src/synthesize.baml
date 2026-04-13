enum Verdict {
  Approve
  RequestChanges
  Reject
}

class FinalVerdict {
  overall_score int @description("Weighted overall code quality score from 1 to 10")
  verdict Verdict @description("Final review decision")
  summary string @description("2-3 sentence executive summary of all reviews")
  must_fix string[] @description("Critical issues that must be addressed before merging")
  should_fix string[] @description("Non-critical improvements worth making")
  praise string[] @description("Aspects of the code that were done well")
}

function SynthesizeReviews(code: string, language: string, architecture_review: string, security_review: string) -> FinalVerdict {
  client GPT4o
  prompt #"
    You are a lead engineer synthesizing multiple code review perspectives
    into a final verdict. You have received reviews from an architecture
    specialist and a security specialist. Consider both carefully and
    produce a balanced, actionable assessment.

    Weight security issues more heavily than design concerns.
    A single critical security vulnerability should result in "reject"
    or "request_changes" regardless of architecture quality.

    Language: {{ language }}

    Code reviewed:
    ```
    {{ code }}
    ```

    Architecture Review:
    {{ architecture_review }}

    Security Review:
    {{ security_review }}

    Synthesize these reviews into a final verdict.

    {{ ctx.output_format }}
  "#
}