import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") process.env[k] = v;
    }

    if (request.method === "GET") {
      return Response.json({
        name: "verdict-agent",
        description: "AI investment decision maker — renders final verdict based on specialist analyses",
        model: "gpt-4o-mini",
        usage: { "POST /": "Submit { pitch, market_analysis, financial_review, tech_assessment } for verdict" },
      });
    }

    if (request.method === "POST") {
      try {
        const { pitch, market_analysis, financial_review, tech_assessment } = await request.json();
        if (!pitch) {
          return Response.json({ error: "Missing 'pitch' field" }, { status: 400 });
        }
        if (!market_analysis || !financial_review || !tech_assessment) {
          return Response.json({ error: "Missing required analysis fields" }, { status: 400 });
        }
        console.log(`[verdict-agent] Rendering verdict for pitch (${pitch.length} chars)`);
        const result = b.RenderVerdict(pitch, market_analysis, financial_review, tech_assessment);
        console.log(`[verdict-agent] Verdict: ${result.decision} (${result.overall_score}/10)`);
        return Response.json({
          agent: "verdict-agent",
          verdict: result,
          renderedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[verdict-agent] Error: ${error.message}`);
        return Response.json({ agent: "verdict-agent", error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },

  async queue(batch, env) {
    console.log(`[verdict-agent] Processing ${batch.messages.length} evaluation(s) from queue`);
    for (const message of batch.messages) {
      const { instanceId, pitch, verdict } = message.body;
      console.log(`[verdict-agent] Logged evaluation ${instanceId}: ${verdict.decision} (${verdict.overall_score}/10)`);
    }
  },
};