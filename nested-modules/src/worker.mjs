import { Router } from './lib/router.mjs';
import { jsonResponse, errorResponse } from './lib/response-helpers.mjs';
import { handleUsers } from './routes/index.mjs';
import { handleHealth } from './routes/health.mjs';

export default {
  async fetch(request, env) {
    const router = new Router();

    router.get('/health', (req) => handleHealth(req, env));
    router.get('/users', (req) => handleUsers(req, env));
    router.get('/', (req) => jsonResponse({
      service: 'nested-modules',
      routes: ['/health', '/users'],
    }));

    return router.handle(request) || errorResponse('Not Found', 404);
  },
};