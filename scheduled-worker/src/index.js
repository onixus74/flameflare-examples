export default {
  // Handles HTTP requests
  async fetch(request, env, ctx) {
    return new Response("This worker runs on a schedule. Check the logs!");
  },

  // Handles scheduled (cron) triggers
  async scheduled(event, env, ctx) {
    console.log(`Cron trigger fired at ${new Date().toISOString()}`);
    console.log(`Cron pattern: ${event.cron}`);
    
    // Example: clean up old data, send reports, sync external APIs
    const result = await doScheduledWork();
    console.log(`Scheduled work completed: ${JSON.stringify(result)}`);
  },
};

async function doScheduledWork() {
  // Simulate some work
  return {
    processed: 42,
    timestamp: new Date().toISOString(),
    status: "success",
  };
}