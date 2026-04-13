import { formatGreeting, getTimestamp } from './utils.mjs';
import config from './config.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/health')) {
      return Response.json({
        status: 'ok',
        version: config.version,
        timestamp: getTimestamp(),
      });
    }

    const name = url.searchParams.get('name') || 'World';
    const greeting = formatGreeting(name, config.appName);

    return Response.json({
      message: greeting,
      timestamp: getTimestamp(),
      config: {
        appName: config.appName,
        version: config.version,
      },
    });
  },
};
