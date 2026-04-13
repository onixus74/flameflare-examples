export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    return new Response(`Hello from Node.js! Path: ${url.pathname}`, {
      headers: { "content-type": "text/plain" },
    });
  },
};