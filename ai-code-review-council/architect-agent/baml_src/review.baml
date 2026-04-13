class ArchitectureReview {
  design_quality int @description("Score from 1 to 10 rating overall design quality")
  patterns_detected string[] @description("Design patterns found in the code such as singleton, factory, observer, MVC")
  concerns string[] @description("Architecture or design concerns found in the code")
  suggestions string[] @description("Concrete improvement suggestions with brief rationale")
  summary string @description("2-3 sentence summary of the architecture review")
}

function ReviewArchitecture(code: string, language: string) -> ArchitectureReview {
  client GPT4o
  prompt #"
    You are a senior software architect performing a code review.
    Focus on design quality, design patterns, modularity, separation
    of concerns, naming conventions, and code organization.

    Language: {{ language }}

    Code to review:
    ```
    {{ code }}
    ```

    Provide a thorough architecture review. Be specific and actionable.
    If the code is very simple, still evaluate what is there.

    {{ ctx.output_format }}
  "#
}