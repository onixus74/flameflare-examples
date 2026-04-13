import { jsonResponse } from '../lib/response-helpers.mjs';

export function handleHealth(request, env) {
  return jsonResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}