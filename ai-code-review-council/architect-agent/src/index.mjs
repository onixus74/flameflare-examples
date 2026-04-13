import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    // Bridge env bindings to process.env for BAML
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") process.env[k] = v;
    }

    if (request.method === "GET") {
      return Response.json({
        name: "architect-agent",
        description: "AI code review agent specializing in architecture and design analysis",
        model: "gpt-4o-mini",
        usage: {
          "POST /": "Submit { code, language } for architecture review",
        },
      });
    }

    if (request.method === "POST") {
      try {
        const { code, language } = await request.json();
        if (!code) {
          return Response.json({ error: "Missing 'code' field" }, { status: 400 });
        }

        console.log(`[architect-agent] Reviewing ${language || "unknown"} code (${code.length} chars)`);
        const review = b.ReviewArchitecture(code, language || "unknown");
        console.log(`[architect-agent] Review complete: score=${review.design_quality}/10`);

        return Response.json({
          agent: "architect-agent",
          review,
          reviewedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[architect-agent] Error: ${error.message}`);
        return Response.json({ agent: "architect-agent", error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
};