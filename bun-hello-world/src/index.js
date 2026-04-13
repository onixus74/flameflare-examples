export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    return new Response(`Hello from Bun! Path: ${url.pathname}`, {
      headers: { "content-type": "text/plain" },
    });
  },
};