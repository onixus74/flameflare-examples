import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") process.env[k] = v;
    }

    if (request.method === "GET") {
      return Response.json({
        name: "financial-reviewer",
        description: "AI financial analyst — evaluates revenue model, unit economics, and profitability",
        model: "gpt-4o-mini",
        usage: { "POST /": "Submit { pitch } for financial analysis" },
      });
    }

    if (request.method === "POST") {
      try {
        const { pitch } = await request.json();
        if (!pitch) {
          return Response.json({ error: "Missing 'pitch' field" }, { status: 400 });
        }
        console.log(`[financial-reviewer] Analyzing pitch (${pitch.length} chars)`);
        const result = b.ReviewFinancials(pitch);
        console.log(`[financial-reviewer] Analysis complete: score=${result.score}/10`);
        return Response.json({
          agent: "financial-reviewer",
          analysis: result,
          analyzedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[financial-reviewer] Error: ${error.message}`);
        return Response.json({ agent: "financial-reviewer", error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
};