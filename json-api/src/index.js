export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/user") {
      return Response.json({
        id: 1,
        name: "John Doe",
        email: "john@example.com",
      });
    }

    if (url.pathname === "/api/time") {
      return Response.json({
        timestamp: new Date().toISOString(),
        timezone: "UTC",
      });
    }

    if (url.pathname === "/api/headers") {
      const headers = Object.fromEntries(request.headers);
      return Response.json({ headers });
    }

    if (url.pathname === "/api/echo" && request.method === "POST") {
      const body = await request.json();
      return Response.json({ echo: body, method: request.method });
    }

    return Response.json(
      {
        error: "Not Found",
        available_routes: ["/api/user", "/api/time", "/api/headers", "/api/echo"],
      },
      { status: 404 }
    );
  },
};