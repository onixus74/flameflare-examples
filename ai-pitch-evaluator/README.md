# AI Startup Pitch Evaluator

A multi-agent AI system that evaluates startup pitches from multiple specialist perspectives and renders an investment verdict. Built on FlameFlare with BAML for structured AI outputs.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   pitch-api     │───▶│  market-analyst  │───▶│ MarketAnalysis  │
│   (coordinator) │    │      (BAML)      │    │   TAM, timing   │
└─────┬───────────┘    └──────────────────┘    └─────────────────┘
      │
      ├────────────────┐    ┌──────────────────┐    ┌─────────────────┐
      └─────────────▶  │───▶│financial-reviewer│───▶│ FinancialReview │
                       │    │      (BAML)      │    │unit economics   │
      ┌─────────────▶  │    └──────────────────┘    └─────────────────┘
      │                │
      │                ├────┐    ┌──────────────────┐    ┌─────────────────┐
      │                └────┼───▶│  tech-assessor   │───▶│ TechAssessment  │
      │                     │    │      (BAML)      │    │  feasibility    │
      │                     │    └──────────────────┘    └─────────────────┘
      │                     │
      │                     └────┐    ┌──────────────────┐    ┌─────────────────┐
      │                          └───▶│  verdict-agent   │───▶│InvestmentVerdict│
      │                               │      (BAML)      │    │ final decision  │
      │                               └─────────┬────────┘    └─────────────────┘
      │                                         │
      ▼                                         ▼
┌─────────────────┐                    ┌─────────────────┐
│ pitch-evaluation│                    │evaluation-queue │
│   (workflow)    │                    │    (logging)    │
└─────────────────┘                    └─────────────────┘
```

## Agent Specializations

| Agent | Role | Focus Areas | Output Schema |
|-------|------|-------------|---------------|
| **market-analyst** | Market Research | TAM estimation, competition analysis, market timing | `MarketAnalysis` |
| **financial-reviewer** | Financial Analysis | Revenue model, unit economics, burn rate, profitability | `FinancialReview` |
| **tech-assessor** | Technical Assessment | Feasibility, scalability, innovation level, technical risks | `TechAssessment` |
| **verdict-agent** | Investment Decision | Weighs all analyses (35% market, 35% financial, 30% technical) | `InvestmentVerdict` |

## BAML Type System

### MarketAnalysis
```typescript
{
  tam_estimate: string;           // "$5B by 2027"
  competition_level: "Low" | "Moderate" | "High" | "Saturated";
  competitors: string[];          // ["Competitor1", "Competitor2"]
  market_timing: "Early" | "RightTime" | "Late";
  opportunities: string[];        // Market tailwinds
  risks: string[];               // Market headwinds
  score: number;                 // 1-10
  summary: string;               // 2-3 sentences
}
```

### FinancialReview
```typescript
{
  revenue_model: string;         // "SaaS", "marketplace", etc.
  unit_economics: string;        // Viability assessment
  burn_rate_concern: "Low" | "Moderate" | "High";
  path_to_profitability: string;
  strengths: string[];
  weaknesses: string[];
  score: number;                 // 1-10
  summary: string;               // 2-3 sentences
}
```

### TechAssessment
```typescript
{
  feasibility: "Low" | "Moderate" | "High";
  tech_stack_opinion: string;
  scalability: "Limited" | "Adequate" | "Excellent";
  innovation_level: "Incremental" | "Significant" | "Breakthrough";
  technical_risks: string[];
  technical_strengths: string[];
  score: number;                 // 1-10
  summary: string;               // 2-3 sentences
}
```

### InvestmentVerdict
```typescript
{
  decision: "StrongPass" | "Pass" | "Consider" | "Invest" | "StrongInvest";
  confidence: number;            // 1-10
  overall_score: number;         // 1-10 weighted score
  key_reasons: string[];         // Top 3 reasons for decision
  conditions: string[];          // Conditions before investing
  dissenting_view?: string;      // Contrarian perspective
  summary: string;               // 2-3 sentence executive summary
}
```

## Deployment

### Prerequisites

```bash
export FLAMEFLARE_URL="http://localhost:4000/client/v4"
export FLAMEFLARE_API_KEY="your-api-token"
export OPENAI_API_KEY="your-openai-key"
```

### Build & Deploy

```bash
# Deploy all 5 workers, set secrets, configure service bindings
./seed.sh
```

This will:
1. Build and deploy 4 BAML agents (Node.js runtime)
2. Deploy pitch-api coordinator (plain JS)
3. Set `OPENAI_API_KEY` secret on all agents
4. Configure service bindings for agent communication
5. Set up queue and workflow infrastructure

### Test

```bash
# Submit a sample pitch for evaluation
./test.sh
```

## Usage

### Submit Pitch for Evaluation

```bash
curl -X POST "http://localhost:4000/client/v4/accounts/$ACCOUNT_ID/workers/scripts/pitch-api/dispatch/evaluate" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "pitch": "CloudSync AI is a B2B SaaS platform that uses machine learning to automatically sync and reconcile data across enterprise cloud applications. We target mid-market companies struggling with data silos. Our ML engine achieves 99.2% sync accuracy. We charge $2,000/month with 85% gross margins. Currently at $500K ARR, raising $3M seed."
  }'
```

### Check Workflow Status

```bash
curl "http://localhost:4000/client/v4/accounts/$ACCOUNT_ID/workers/scripts/pitch-api/dispatch/status?instanceId=workflow-id" \
  -H "Authorization: Bearer $FLAMEFLARE_API_KEY"
```

### Example Response

```json
{
  "success": true,
  "instanceId": "workflow-12345",
  "marketAnalysis": {
    "tam_estimate": "$12B enterprise data integration market by 2027",
    "competition_level": "High",
    "competitors": ["MuleSoft", "Zapier", "Segment"],
    "market_timing": "RightTime",
    "score": 7,
    "summary": "Large addressable market with strong demand, but facing established competition."
  },
  "financialReview": {
    "revenue_model": "SaaS subscription",
    "unit_economics": "Strong with 85% gross margins and $2K monthly pricing",
    "burn_rate_concern": "Low",
    "score": 8,
    "summary": "Solid business model with healthy unit economics and clear path to profitability."
  },
  "techAssessment": {
    "feasibility": "High",
    "scalability": "Excellent",
    "innovation_level": "Significant",
    "score": 8,
    "summary": "Technically sound with proven accuracy metrics and scalable ML architecture."
  },
  "verdict": {
    "decision": "Invest",
    "confidence": 8,
    "overall_score": 8,
    "key_reasons": [
      "Strong market demand for data integration solutions",
      "Healthy unit economics with 85% gross margins",
      "Proven technical solution with 99.2% accuracy"
    ],
    "conditions": [
      "Validate customer acquisition strategy",
      "Assess competitive differentiation depth"
    ],
    "summary": "Strong investment opportunity with solid fundamentals across market, financials, and technology. Proceed with due diligence on go-to-market execution."
  },
  "completedAt": "2024-01-01T12:00:00.000Z"
}
```

## Development

### Local Testing

Each agent can be tested individually:

```bash
# Test market analyst
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -d '{"pitch": "Your startup pitch here"}'

# Test via service bindings through pitch-api
curl -X POST http://localhost:8787/evaluate \
  -H "Content-Type: application/json" \
  -d '{"pitch": "Your startup pitch here"}'
```

### Adding New Analysis Criteria

1. Update the relevant BAML schema in `baml_src/analysis.baml`
2. Regenerate TypeScript types: `npm run generate`
3. Update the agent logic in `src/index.mjs`
4. Rebuild and redeploy: `npm run build && ff deploy`

### Customizing Decision Logic

The investment verdict weighs analyses as:
- Market opportunity: 35%
- Financial viability: 35%  
- Technical feasibility: 30%

To modify this, update the prompt in `verdict-agent/baml_src/verdict.baml`.

## Architecture Notes

- **pitch-api**: Plain JavaScript coordinator, orchestrates the evaluation flow
- **Agents**: Node.js runtime with BAML for structured AI outputs
- **Queue**: Asynchronous logging of completed evaluations
- **Workflow**: Durable tracking of evaluation lifecycle
- **Service Bindings**: Direct agent-to-agent communication
- **Secrets**: OpenAI API keys stored securely per agent

The system is designed for high reliability with proper error handling, partial result recovery, and comprehensive logging throughout the evaluation pipeline.