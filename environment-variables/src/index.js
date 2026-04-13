export default {
  async fetch(request, env, ctx) {
    return Response.json({
      message: `Hello from ${env.APP_NAME}!`,
      environment: env.ENVIRONMENT,
      api_version: env.API_VERSION,
      secret_configured: env.SECRET_KEY ? true : false,
    });
  },
};