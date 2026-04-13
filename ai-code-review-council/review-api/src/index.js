/**
 * Code Review API — Coordinator for the AI Code Review Council
 *
 * Receives code submissions and orchestrates a multi-agent review:
 *   1. Architecture review (via ARCHITECT_AGENT service binding)
 *   2. Security review (via SECURITY_AGENT service binding)
 *   3. Synthesis into final verdict (via SYNTHESIZER_AGENT service binding)
 *   4. Verdict delivered to verdict-queue for logging
 *
 * Bindings:
 *   - CODE_REVIEW_WORKFLOW: Workflow binding to code-review
 *   - VERDICT_QUEUE: Queue producer to verdict-queue
 *   - ARCHITECT_AGENT: Service binding to architect-agent
 *   - SECURITY_AGENT: Service binding to security-agent
 *   - SYNTHESIZER_AGENT: Service binding to synthesizer-agent
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    try {
      if (request.method === "POST" && url.pathname === "/review") {
        return await handleSubmitReview(request, env);
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
          name: "review-api",
          description: "AI Code Review Council — submit code for multi-agent review",
          agents: ["architect-agent", "security-agent", "synthesizer-agent"],
          endpoints: {
            "POST /review": "Submit code for review (body: { code, language })",
            "GET /status?instanceId=xxx": "Check review workflow progress",
          },
          example: {
            code: "function add(a, b) { return a + b; }",
            language: "javascript",
          },
        });
      }

      return Response.json({ error: "Not found" }, { status: 404 });
    } catch (error) {
      console.error("[review-api] Error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  },
};

async function callAgent(env, bindingName, code, language, extraBody = {}) {
  const binding = env[bindingName];
  if (!binding) {
    throw new Error(`Service binding ${bindingName} not configured`);
  }
  const resp = await binding.fetch(
    new Request("http://agent/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, language, ...extraBody }),
    })
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`${bindingName} returned ${resp.status}: ${errText}`);
  }
  return await resp.json();
}

async function handleSubmitReview(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    input = {
      code: "function add(a, b) { return a + b; }",
      language: "javascript",
    };
  }

  const code = input.code || "";
  const language = input.language || "unknown";

  if (!code.trim()) {
    return Response.json({ error: "Code cannot be empty" }, { status: 400 });
  }

  console.log(`[review-api] New review: ${language}, ${code.length} chars`);

  // Start tracking workflow
  let instanceId = null;
  if (env.CODE_REVIEW_WORKFLOW) {
    try {
      const instance = await env.CODE_REVIEW_WORKFLOW.create({
        params: { code, language, submittedAt: new Date().toISOString() },
      });
      instanceId = instance?.id || null;
    } catch (e) {
      console.error(`[review-api] Workflow start failed: ${e.message}`);
    }
  }

  // Call agents via service bindings
  let archResult = null;
  let secResult = null;
  let synthesisResult = null;

  try {
    // Step 1: Architecture review
    console.log("[review-api] Calling architect-agent...");
    archResult = await callAgent(env, "ARCHITECT_AGENT", code, language);

    // Step 2: Security review
    console.log("[review-api] Calling security-agent...");
    secResult = await callAgent(env, "SECURITY_AGENT", code, language);

    // Step 3: Synthesize
    console.log("[review-api] Calling synthesizer-agent...");
    synthesisResult = await callAgent(env, "SYNTHESIZER_AGENT", code, language, {
      architecture_review: archResult.review,
      security_review: secResult.review,
    });

    console.log(`[review-api] Verdict: ${synthesisResult.verdict?.verdict} (${synthesisResult.verdict?.overall_score}/10)`);
  } catch (agentError) {
    console.error(`[review-api] Agent call failed: ${agentError.message}`);
    return Response.json({
      success: false,
      instanceId,
      error: agentError.message,
      partialResults: {
        architectureReview: archResult?.review || null,
        securityReview: secResult?.review || null,
      },
    }, { status: 500 });
  }

  // Enqueue verdict for logging
  if (env.VERDICT_QUEUE) {
    try {
      await env.VERDICT_QUEUE.send({
        instanceId,
        code,
        language,
        architectureReview: archResult.review,
        securityReview: secResult.review,
        verdict: synthesisResult.verdict,
        completedAt: new Date().toISOString(),
      });
    } catch (qErr) {
      console.error(`[review-api] Queue send failed: ${qErr.message}`);
    }
  }

  return Response.json({
    success: true,
    instanceId,
    architectureReview: archResult.review,
    securityReview: secResult.review,
    verdict: synthesisResult.verdict,
    completedAt: new Date().toISOString(),
  });
}

async function handleCheckStatus(instanceId, env) {
  try {
    if (!env.CODE_REVIEW_WORKFLOW) {
      return Response.json({ error: "Workflow binding not configured" }, { status: 500 });
    }
    const instance = await env.CODE_REVIEW_WORKFLOW.get(instanceId);
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
 * Code Review Workflow — tracks the lifecycle of a code review.
 * The actual agent calls happen in the fetch handler via service bindings.
 * This workflow provides durable tracking and status.
 */
export class CodeReviewWorkflow {
  async run(event, step) {
    const { code, language } = event.payload;

    // Step 1: Mark as received
    const submission = await step.do("validate-submission", async () => {
      if (!code || !code.trim()) throw new Error("Empty code submission");
      return {
        language,
        codeLength: code.length,
        validatedAt: new Date().toISOString(),
      };
    });

    // Step 2: Wait for review to complete (the fetch handler does the real work)
    await step.sleep("await-review-completion", "5 seconds");

    // Step 3: Mark complete
    const completion = await step.do("mark-complete", async () => {
      return {
        status: "complete",
        language: submission.language,
        codeLength: submission.codeLength,
        completedAt: new Date().toISOString(),
      };
    });

    return completion;
  }
}