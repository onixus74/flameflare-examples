import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    // Bridge env bindings to process.env for BAML
    for (const [k, v] of Object.entries(env)) {
      if (typeof v === "string") process.env[k] = v;
    }

    if (request.method === "GET") {
      return Response.json({
        name: "security-agent",
        description: "AI code review agent specializing in security vulnerability analysis",
        model: "gpt-4o-mini",
        usage: {
          "POST /": "Submit { code, language } for security review",
        },
      });
    }

    if (request.method === "POST") {
      try {
        const { code, language } = await request.json();
        if (!code) {
          return Response.json({ error: "Missing 'code' field" }, { status: 400 });
        }

        console.log(`[security-agent] Reviewing ${language || "unknown"} code (${code.length} chars)`);
        const review = b.ReviewSecurity(code, language || "unknown");
        console.log(`[security-agent] Review complete: risk=${review.risk_level}`);

        return Response.json({
          agent: "security-agent",
          review,
          reviewedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`[security-agent] Error: ${error.message}`);
        return Response.json({ agent: "security-agent", error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  },
};