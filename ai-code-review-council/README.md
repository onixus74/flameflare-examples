# AI Code Review Council

A sophisticated multi-agent AI system that performs comprehensive code reviews using three specialist AI agents orchestrated through Cloudflare Workers, Queues, and Workflows.

## Architecture

```
┌─────────────────┐
│   review-api    │ ◄── POST /review (code submission)
│   (coordinator) │
└─────┬───────────┘
      │ service bindings
      ▼
┌─────────────────────────────────────────────────────────┐
│                   Specialist Agents                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  architect-  │  │  security-   │  │ synthesizer- │  │
│  │    agent     │  │    agent     │  │    agent     │  │
│  │   (BAML)     │  │   (BAML)     │  │   (BAML)     │  │
│  └──────────────┘  └──────────────┘  └──────┬───────┘  │
└─────────────────────────────────────────────┼─────────┘
                                              │ queue consumer
                                              ▼
                                    ┌─────────────────┐
                                    │  verdict-queue  │
                                    │ (async logging) │
                                    └─────────────────┘
              ┌─────────────────┐
              │ code-review     │
              │ (workflow)      │
              │ lifecycle track │
              └─────────────────┘
```

## Specialist Agents

### 🏗️ **Architect Agent** (`architect-agent`)
- **Focus**: Design quality, patterns, modularity, organization
- **BAML Types**: `ArchitectureReview` with design quality score (1-10), patterns detected, concerns, suggestions
- **Analysis**: Evaluates design patterns (singleton, factory, MVC), separation of concerns, naming conventions

### 🔒 **Security Agent** (`security-agent`) 
- **Focus**: Vulnerability detection, OWASP concerns, security best practices
- **BAML Types**: `SecurityReview` with risk level, `Vulnerability[]` with severity levels
- **Analysis**: Identifies injection attacks, data exposure, auth issues, input validation gaps

### ⚖️ **Synthesizer Agent** (`synthesizer-agent`)
- **Focus**: Combines reviews into actionable final verdict
- **BAML Types**: `FinalVerdict` with overall score, verdict (approve/request_changes/reject), must-fix/should-fix lists
- **Logic**: Weights security issues heavily; single critical vulnerability → reject/request_changes

## Integration Features

- **Service Bindings**: Direct inter-worker communication between coordinator and agents
- **Queue Integration**: Async verdict delivery via `verdict-queue` for audit logging
- **Workflow Tracking**: Durable lifecycle tracking with `code-review` workflow
- **BAML Extraction**: Structured AI outputs with type safety and validation

## Example Review Output

```json
{
  "success": true,
  "instanceId": "wf_abc123",
  "architectureReview": {
    "design_quality": 3,
    "patterns_detected": ["direct database access"],
    "concerns": ["No separation between data access and business logic"],
    "suggestions": ["Extract database queries into a repository layer"],
    "summary": "Code lacks proper layering and has tightly coupled database access."
  },
  "securityReview": {
    "risk_level": "high",
    "vulnerabilities": [
      {
        "severity": "high",
        "description": "SQL injection vulnerability in fetchUser function",
        "location": "fetchUser function, line 2",
        "fix": "Use parameterized queries instead of string concatenation"
      }
    ],
    "recommendations": ["Implement input validation", "Use prepared statements"],
    "summary": "Critical SQL injection vulnerability found. Immediate fix required."
  },
  "verdict": {
    "overall_score": 2,
    "verdict": "reject",
    "summary": "Code contains critical security vulnerability that must be fixed before merging. Architecture also needs improvement.",
    "must_fix": ["Fix SQL injection in fetchUser function"],
    "should_fix": ["Add repository layer for database access"],
    "praise": ["Function name is descriptive"]
  }
}
```

## Prerequisites

- **Node.js** (18+) and **npm**
- **OpenAI API Key** (`OPENAI_API_KEY` environment variable)
- **FlameFlare** instance running with API access

## Deploy

```bash
# Set required environment variables
export FLAMEFLARE_URL="http://localhost:4000/client/v4"
export FLAMEFLARE_API_KEY="your-api-token"  
export OPENAI_API_KEY="sk-..."

# Build and deploy all components
./seed.sh
```

The seed script will:
1. Build all 3 BAML agents (install deps, generate types, bundle)
2. Deploy all 4 workers (`review-api`, `architect-agent`, `security-agent`, `synthesizer-agent`)
3. Configure OpenAI API key secrets on each agent
4. Set up service bindings for inter-worker communication

## Test

```bash
# Run end-to-end test with problematic code sample
./test.sh

# Or test manually:
curl -X POST "$FLAMEFLARE_URL/accounts/$ACCOUNT_ID/workers/review-api/dispatch/review" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function fetchUser(id) {\n  const query = \"SELECT * FROM users WHERE id = \" + id;\n  return db.query(query);\n}",
    "language": "javascript"
  }'
```

## Individual Agent Testing

Each agent can be tested independently:

```bash
# Test architect agent
curl -X POST "$BASE/architect-agent/dispatch/" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"function add(a,b){return a+b;}", "language":"javascript"}'

# Test security agent  
curl -X POST "$BASE/security-agent/dispatch/" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"const query = \"SELECT * FROM users WHERE id = \" + userId;", "language":"javascript"}'

# Test synthesizer (requires both reviews)
curl -X POST "$BASE/synthesizer-agent/dispatch/" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"code":"...","language":"js","architecture_review":{...},"security_review":{...}}'
```

## Workflow Tracking

Check review progress:

```bash
curl -X GET "$BASE/review-api/dispatch/status?instanceId=wf_abc123" \
  -H "Authorization: Bearer $TOKEN"
```

## Components

| Component | Purpose | Tech |
|-----------|---------|------|
| `review-api` | Coordinator, orchestrates agents | Workers + Service Bindings |
| `architect-agent` | Design & architecture analysis | BAML + GPT-4o-mini |
| `security-agent` | Security vulnerability detection | BAML + GPT-4o-mini |
| `synthesizer-agent` | Final verdict synthesis | BAML + GPT-4o-mini + Queue Consumer |
| `verdict-queue` | Async audit logging | Cloudflare Queues |
| `code-review` | Lifecycle tracking | Cloudflare Workflows |

## BAML Schema Summary

```typescript
// Architecture Review
class ArchitectureReview {
  design_quality: number;     // 1-10 score
  patterns_detected: string[]; // Design patterns found
  concerns: string[];         // Architecture issues
  suggestions: string[];      // Improvement recommendations
  summary: string;           // 2-3 sentence summary
}

// Security Review
enum Severity { low | medium | high | critical }
class Vulnerability {
  severity: Severity;
  description: string;
  location?: string;
  fix: string;
}
class SecurityReview {
  risk_level: Severity;
  vulnerabilities: Vulnerability[];
  recommendations: string[];
  summary: string;
}

// Final Verdict
enum Verdict { approve | request_changes | reject }
class FinalVerdict {
  overall_score: number;    // 1-10 weighted score
  verdict: Verdict;         // Final decision
  summary: string;          // Executive summary
  must_fix: string[];       // Critical issues
  should_fix: string[];     // Non-critical improvements
  praise: string[];         // Positive aspects
}
```

This example demonstrates a production-ready multi-agent AI system that showcases the full power of FlameFlare's Workers + Queues + Workflows integration with type-safe AI interactions via BAML.