// A simple router worker demonstrating common patterns

function handleOptions(request) {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

async function handleGetTodos(env) {
  // In a real app, you'd fetch from KV or D1
  const todos = [
    { id: 1, title: "Deploy to FlameFlare", completed: true },
    { id: 2, title: "Add environment variables", completed: false },
    { id: 3, title: "Set up monitoring", completed: false },
  ];
  return Response.json(todos);
}

async function handleCreateTodo(request) {
  const body = await request.json();
  const todo = {
    id: Date.now(),
    title: body.title || "Untitled",
    completed: false,
    created_at: new Date().toISOString(),
  };
  return Response.json(todo, { status: 201 });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return handleOptions(request);
    }

    // Route matching
    if (pathname === "/todos" && method === "GET") {
      return handleGetTodos(env);
    }

    if (pathname === "/todos" && method === "POST") {
      return handleCreateTodo(request);
    }

    if (pathname === "/health") {
      return Response.json({ status: "ok", uptime: Date.now() });
    }

    if (pathname === "/" || pathname === "") {
      return new Response(
        `<!DOCTYPE html>
<html>
<head><title>Router Worker</title></head>
<body>
  <h1>🔥 FlameFlare Router Worker</h1>
  <p>Try these endpoints:</p>
  <ul>
    <li><a href="/todos">GET /todos</a></li>
    <li>POST /todos (with JSON body)</li>
    <li><a href="/health">GET /health</a></li>
  </ul>
</body>
</html>`,
        { headers: { "content-type": "text/html" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};