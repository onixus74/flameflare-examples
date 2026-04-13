import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") process.env[k] = v;
    }

    if (request.method === "GET") {
      return Response.json({
        name: "market-analyst",
        description: "AI market research analyst — evaluates TAM, competition, and market timing",
        model: "gpt-4o-mini",
        usage: { "POST /": "Submit { pitch } for market analysis" },
      });
    }

    if (request.method === "POST") {
      try {
        const { pitch } = await request.json();
        if (!pitch) {
          return Response.json({ error: "Missing 'pitch' field" }, { status: 400 });
        }
        console.log(`[market-analyst] Analyzing pitch (${pitch.length} chars)`);
        const result = b.AnalyzeMarket(pitch);
        console.log(`[market-analyst] Analysis complete: score=${result.score}/10`);
        return Response.json({
          agent: "market-analyst",
          analysis: result,
          analyzedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[market-analyst] Error: ${error.message}`);
        return Response.json({ agent: "market-analyst", error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
};