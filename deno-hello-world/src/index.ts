export default {
  async fetch(request: Request, env: Record<string, string>): Promise<Response> {
    const url = new URL(request.url);
    return new Response(`Hello from Deno! Path: ${url.pathname}`, {
      headers: { "content-type": "text/plain" },
    });
  },
};