/**
 * Pitch API — Coordinator for the AI Startup Pitch Evaluator
 *
 * Receives pitch submissions and orchestrates a multi-agent evaluation:
 *   1. Market analysis (via MARKET_ANALYST service binding)
 *   2. Financial review (via FINANCIAL_REVIEWER service binding)
 *   3. Technical assessment (via TECH_ASSESSOR service binding)
 *   4. Investment verdict (via VERDICT_AGENT service binding)
 *   5. Verdict delivered to evaluation-queue for logging
 *
 * Bindings:
 *   - PITCH_EVALUATION_WORKFLOW: Workflow binding to pitch-evaluation
 *   - EVALUATION_QUEUE: Queue producer to evaluation-queue
 *   - MARKET_ANALYST: Service binding to market-analyst
 *   - FINANCIAL_REVIEWER: Service binding to financial-reviewer
 *   - TECH_ASSESSOR: Service binding to tech-assessor
 *   - VERDICT_AGENT: Service binding to verdict-agent
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/evaluate") {
        return await handleSubmitEvaluation(request, env);
      }

      if (request.method === "GET" && url.pathname === "/status") {
        const instanceId = url.searchParams.get("instanceId");
        if (!instanceId) {
          return Response.json({ error: "Missing instanceId parameter" }, { status: 400 });
        }
        return await handleCheckStatus(instanceId, env);
      }

      if (request.method === "GET" && url.pathname === "/") {
        return Response.json({
          name: "pitch-api",
          description: "AI Startup Pitch Evaluator — submit a pitch for multi-agent evaluation",
          agents: ["market-analyst", "financial-reviewer", "tech-assessor", "verdict-agent"],
          endpoints: {
            "POST /evaluate": "Submit pitch for evaluation (body: { pitch })",
            "GET /status?instanceId=xxx": "Check evaluation workflow progress",
          },
          example: {
            pitch: "CloudSync AI is a B2B SaaS platform that uses machine learning to automatically sync and reconcile data across enterprise cloud applications. We target mid-market companies ($10M-$500M revenue) struggling with data silos across Salesforce, HubSpot, Netsuite, and 50+ other cloud apps. Our proprietary ML engine learns each company's data patterns and achieves 99.2% sync accuracy with zero manual mapping. We charge $2,000/month per company with 85% gross margins. Currently at $500K ARR with 25 customers, growing 20% MoM. The team includes ex-engineers from Salesforce and Snowflake. We're raising $3M seed to expand our sales team and add 10 more integrations.",
          },
        });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      console.error("[pitch-api] Error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  },
};

async function callAgent(env, bindingName, pitch, extraBody = {}) {
  const binding = env[bindingName];
  if (!binding) {
    throw new Error(`Service binding ${bindingName} not configured`);
  }
  const resp = await binding.fetch(
    new Request("http://agent/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitch, ...extraBody }),
    })
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`${bindingName} returned ${resp.status}: ${errText}`);
  }
  return await resp.json();
}

async function handleSubmitEvaluation(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    input = {
      pitch: "CloudSync AI is a B2B SaaS platform that uses machine learning to automatically sync and reconcile data across enterprise cloud applications. We target mid-market companies ($10M-$500M revenue) struggling with data silos across Salesforce, HubSpot, Netsuite, and 50+ other cloud apps. Our proprietary ML engine learns each company's data patterns and achieves 99.2% sync accuracy with zero manual mapping. We charge $2,000/month per company with 85% gross margins. Currently at $500K ARR with 25 customers, growing 20% MoM. The team includes ex-engineers from Salesforce and Snowflake. We're raising $3M seed to expand our sales team and add 10 more integrations.",
    };
  }

  const pitch = input.pitch || "";

  if (!pitch.trim()) {
    return Response.json({ error: "Pitch cannot be empty" }, { status: 400 });
  }

  console.log(`[pitch-api] New evaluation: ${pitch.length} chars`);

  // Start tracking workflow
  let instanceId = null;
  if (env.PITCH_EVALUATION_WORKFLOW) {
    try {
      const instance = await env.PITCH_EVALUATION_WORKFLOW.create({
        params: { pitch, submittedAt: new Date().toISOString() },
      });
      instanceId = instance?.id || null;
    } catch (e) {
      console.error(`[pitch-api] Workflow start failed: ${e.message}`);
    }
  }

  // Call agents via service bindings
  let marketResult = null;
  let financialResult = null;
  let techResult = null;
  let verdictResult = null;

  try {
    // Step 1: Market analysis
    console.log("[pitch-api] Calling market-analyst...");
    marketResult = await callAgent(env, "MARKET_ANALYST", pitch);

    // Step 2: Financial review
    console.log("[pitch-api] Calling financial-reviewer...");
    financialResult = await callAgent(env, "FINANCIAL_REVIEWER", pitch);

    // Step 3: Technical assessment
    console.log("[pitch-api] Calling tech-assessor...");
    techResult = await callAgent(env, "TECH_ASSESSOR", pitch);

    // Step 4: Investment verdict
    console.log("[pitch-api] Calling verdict-agent...");
    verdictResult = await callAgent(env, "VERDICT_AGENT", pitch, {
      market_analysis: JSON.stringify(marketResult.analysis),
      financial_review: JSON.stringify(financialResult.analysis),
      tech_assessment: JSON.stringify(techResult.analysis),
    });

    console.log(`[pitch-api] Verdict: ${verdictResult.verdict?.decision} (${verdictResult.verdict?.overall_score}/10)`);
  } catch (agentError) {
    console.error(`[pitch-api] Agent call failed: ${agentError.message}`);
    return Response.json({
      success: false,
      instanceId,
      error: agentError.message,
      partialResults: {
        marketAnalysis: marketResult?.analysis || null,
        financialReview: financialResult?.analysis || null,
        techAssessment: techResult?.analysis || null,
      },
    }, { status: 500 });
  }

  // Enqueue verdict for logging
  if (env.EVALUATION_QUEUE) {
    try {
      await env.EVALUATION_QUEUE.send({
        instanceId,
        pitch,
        marketAnalysis: marketResult.analysis,
        financialReview: financialResult.analysis,
        techAssessment: techResult.analysis,
        verdict: verdictResult.verdict,
        completedAt: new Date().toISOString(),
      });
    } catch (qErr) {
      console.error(`[pitch-api] Queue send failed: ${qErr.message}`);
    }
  }

  return Response.json({
    success: true,
    instanceId,
    marketAnalysis: marketResult.analysis,
    financialReview: financialResult.analysis,
    techAssessment: techResult.analysis,
    verdict: verdictResult.verdict,
    completedAt: new Date().toISOString(),
  });
}

async function handleCheckStatus(instanceId, env) {
  try {
    if (!env.PITCH_EVALUATION_WORKFLOW) {
      return Response.json({ error: "Workflow binding not configured" }, { status: 500 });
    }
    const instance = await env.PITCH_EVALUATION_WORKFLOW.get(instanceId);
    if (!instance) {
      return Response.json({ error: "Instance not found" }, { status: 404 });
    }
    const status = await instance.status();
    return Response.json({ instanceId, status: status.status, output: status.output });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Pitch Evaluation Workflow — tracks the lifecycle of a pitch evaluation.
 * The actual agent calls happen in the fetch handler via service bindings.
 * This workflow provides durable tracking and status.
 */
export class PitchEvaluationWorkflow {
  async run(event, step) {
    const { pitch } = event.payload;

    // Step 1: Mark as received
    const submission = await step.do("validate-submission", async () => {
      if (!pitch || !pitch.trim()) throw new Error("Empty pitch submission");
      return {
        pitchLength: pitch.length,
        validatedAt: new Date().toISOString(),
      };
    });

    // Step 2: Wait for evaluation to complete (the fetch handler does the real work)
    await step.sleep("await-evaluation-completion", "5 seconds");

    // Step 3: Mark complete
    const completion = await step.do("mark-complete", async () => {
      return {
        status: "complete",
        pitchLength: submission.pitchLength,
        completedAt: new Date().toISOString(),
      };
    });

    return completion;
  }
}