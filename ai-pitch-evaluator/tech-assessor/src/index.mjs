import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") process.env[k] = v;
    }

    if (request.method === "GET") {
      return Response.json({
        name: "tech-assessor",
        description: "AI technical assessor — evaluates feasibility, scalability, and innovation",
        model: "gpt-4o-mini",
        usage: { "POST /": "Submit { pitch } for technical assessment" },
      });
    }

    if (request.method === "POST") {
      try {
        const { pitch } = await request.json();
        if (!pitch) {
          return Response.json({ error: "Missing 'pitch' field" }, { status: 400 });
        }
        console.log(`[tech-assessor] Analyzing pitch (${pitch.length} chars)`);
        const result = b.AssessTechnology(pitch);
        console.log(`[tech-assessor] Analysis complete: score=${result.score}/10`);
        return Response.json({
          agent: "tech-assessor",
          analysis: result,
          analyzedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[tech-assessor] Error: ${error.message}`);
        return Response.json({ agent: "tech-assessor", error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
};