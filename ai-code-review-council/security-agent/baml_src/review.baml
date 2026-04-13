enum Severity {
  Low
  Medium
  High
  Critical
}

class Vulnerability {
  severity Severity @description("How severe this vulnerability is")
  description string @description("What the vulnerability is and why it matters")
  location string? @description("Approximate location in the code, e.g. line reference or function name")
  fix string @description("How to fix this vulnerability")
}

class SecurityReview {
  risk_level Severity @description("Overall risk level of the code")
  vulnerabilities Vulnerability[] @description("Security vulnerabilities found in the code")
  recommendations string[] @description("General security best practice recommendations")
  summary string @description("2-3 sentence summary of the security review")
}

function ReviewSecurity(code: string, language: string) -> SecurityReview {
  client GPT4o
  prompt #"
    You are a senior security engineer performing a code review.
    Focus on identifying vulnerabilities such as injection attacks,
    data exposure, authentication issues, input validation gaps,
    insecure defaults, and other OWASP-style concerns.

    Language: {{ language }}

    Code to review:
    ```
    {{ code }}
    ```

    Identify all security concerns. Be thorough but avoid false positives.
    If the code is very simple, note what security considerations would
    apply as it grows.

    {{ ctx.output_format }}
  "#
}