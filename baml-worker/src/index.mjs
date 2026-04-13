// BAML Worker — structured LLM extraction via @boundaryml/baml
//
// This Worker accepts a POST request with resume text and returns
// structured data extracted via an LLM using BAML's type-safe runtime.
//
// Requires:
//   - OPENAI_API_KEY secret binding
//   - npm run build (to assemble dist/ with baml_client + native addon)

import { b } from "../baml_client";

export default {
  async fetch(request, env) {
    // Bridge env binding to process.env so BAML can read it
    if (env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
    }

    if (request.method !== "POST") {
      return Response.json({
        service: "baml-worker",
        description: "Structured LLM extraction using BAML",
        usage: "POST with JSON body: { \"resume_text\": \"...\" }",
        example: {
          resume_text: "John Doe, CTO at Acme Inc. Expert in Python and Rust. MIT 2015."
        },
      });
    }

    try {
      const body = await request.json();
      const { resume_text } = body;

      if (!resume_text) {
        return Response.json(
          { error: "Missing 'resume_text' in request body" },
          { status: 400 }
        );
      }

      const result = await b.ExtractResume(resume_text);
      return Response.json({ success: true, data: result });
    } catch (error) {
      return Response.json(
        { error: error.message || "Internal error" },
        { status: 500 }
      );
    }
  },
};