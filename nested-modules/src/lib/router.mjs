export class Router {
  constructor() {
    this.routes = [];
  }

  get(path, handler) {
    this.routes.push({ method: 'GET', path, handler });
  }

  handle(request) {
    const url = new URL(request.url);
    const method = request.method;

    for (const route of this.routes) {
      if (route.method === method && url.pathname === route.path) {
        return route.handler(request);
      }
    }
    return null;
  }
}