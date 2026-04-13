import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    // Bridge env bindings to process.env for BAML
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") process.env[k] = v;
    }

    if (request.method === "GET") {
      return Response.json({
        name: "synthesizer-agent",
        description: "AI code review synthesizer that produces a final verdict from multiple specialist reviews",
        model: "gpt-4o-mini",
        usage: {
          "POST /": "Submit { code, language, architecture_review, security_review } for synthesis",
        },
      });
    }

    if (request.method === "POST") {
      try {
        const { code, language, architecture_review, security_review } = await request.json();
        if (!code || !architecture_review || !security_review) {
          return Response.json({
            error: "Missing required fields: code, architecture_review, security_review",
          }, { status: 400 });
        }

        console.log(`[synthesizer-agent] Synthesizing reviews for ${language || "unknown"} code`);

        // Convert review objects to strings for the prompt
        const archStr = typeof architecture_review === "string"
          ? architecture_review
          : JSON.stringify(architecture_review, null, 2);
        const secStr = typeof security_review === "string"
          ? security_review
          : JSON.stringify(security_review, null, 2);

        const verdict = b.SynthesizeReviews(code, language || "unknown", archStr, secStr);
        console.log(`[synthesizer-agent] Verdict: ${verdict.verdict} (score: ${verdict.overall_score}/10)`);

        return Response.json({
          agent: "synthesizer-agent",
          verdict,
          synthesizedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[synthesizer-agent] Error: ${error.message}`);
        return Response.json({ agent: "synthesizer-agent", error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },

  // Queue consumer: log completed verdicts from verdict-queue
  async queue(batch, env) {
    console.log(`[synthesizer-agent] Processing ${batch.messages.length} verdict notifications`);

    for (const message of batch.messages) {
      try {
        const verdict = message.body;
        console.log(`[synthesizer-agent] Verdict delivered: ${verdict.verdict?.verdict || "unknown"} for submission ${verdict.submissionId || "unknown"}`);
        console.log(`[synthesizer-agent]   Score: ${verdict.verdict?.overall_score || "?"}/10`);
        console.log(`[synthesizer-agent]   Must-fix items: ${verdict.verdict?.must_fix?.length || 0}`);
        message.ack();
      } catch (error) {
        console.error(`[synthesizer-agent] Queue processing error: ${error.message}`);
        message.retry();
      }
    }
  },
};