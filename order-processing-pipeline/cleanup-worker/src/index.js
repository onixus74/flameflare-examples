/**
 * Cleanup Worker
 * 
 * Handles cleanup tasks for the order processing pipeline.
 * Supports two trigger methods:
 * 1. Cron triggers (scheduled cleanup every 5 minutes)
 * 2. Service binding calls (on-demand cleanup from other workers)
 * 
 * Cleanup tasks include:
 * - Removing stale order reservations
 * - Cleaning up expired workflow instances
 * - Purging old queue messages
 * - Archiving completed orders
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Service binding endpoint - called by other workers
    if (url.pathname === "/__service_call" || request.method === "POST") {
      console.log("[cleanup-worker] Running cleanup via service binding call");
      
      let triggerData = {};
      try {
        triggerData = await request.json();
      } catch {
        // No JSON body, use default
      }
      
      const result = await performCleanup("service_binding", triggerData);
      return Response.json({ 
        source: "service_binding", 
        triggeredBy: triggerData.triggeredBy || "unknown",
        ...result 
      });
    }
    
    // Default info endpoint
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        name: "cleanup-worker",
        version: "1.0.0",
        description: "Cleans up stale orders and workflow data",
        triggers: [
          "Cron: Every 5 minutes (*/5 * * * *)",
          "Service binding: On-demand via order-api"
        ],
        cleanup_tasks: [
          "Remove expired inventory reservations",
          "Archive completed workflow instances", 
          "Purge old queue messages",
          "Clean up temporary order data"
        ],
        endpoints: {
          "GET /": "Worker information",
          "POST /__service_call": "Service binding endpoint"
        }
      });
    }
    
    return Response.json({ 
      error: "Unknown endpoint" 
    }, { status: 404 });
  },

  /**
   * Scheduled handler - called by cron trigger
   */
  async scheduled(event, env, ctx) {
    const scheduledTime = new Date(event.scheduledTime).toISOString();
    console.log(`[cleanup-worker] Cron triggered at ${scheduledTime}`);
    console.log(`[cleanup-worker] Cron expression: ${event.cron}`);
    
    const result = await performCleanup("cron", { 
      scheduledTime,
      cron: event.cron 
    });
    
    console.log(`[cleanup-worker] Scheduled cleanup complete: ${JSON.stringify(result)}`);
  }
};

/**
 * Core cleanup logic
 */
async function performCleanup(source = "manual", triggerInfo = {}) {
  const startTime = Date.now();
  console.log(`[cleanup-worker] Starting cleanup (source: ${source})`);
  
  const results = {
    startedAt: new Date().toISOString(),
    source,
    triggerInfo,
    tasks: {}
  };
  
  try {
    // Task 1: Clean up expired inventory reservations
    results.tasks.reservations = await cleanupExpiredReservations();
    
    // Task 2: Archive completed workflows  
    results.tasks.workflows = await archiveCompletedWorkflows();
    
    // Task 3: Purge old queue messages
    results.tasks.queues = await purgeOldQueueMessages();
    
    // Task 4: Clean up temporary order data
    results.tasks.tempData = await cleanupTemporaryData();
    
    const duration = Date.now() - startTime;
    results.completedAt = new Date().toISOString();
    results.duration_ms = duration;
    results.status = "success";
    
    console.log(`[cleanup-worker] Cleanup completed in ${duration}ms`);
    return results;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[cleanup-worker] Cleanup failed after ${duration}ms:`, error);
    
    results.completedAt = new Date().toISOString();
    results.duration_ms = duration;
    results.status = "failed";
    results.error = error.message;
    
    return results;
  }
}

async function cleanupExpiredReservations() {
  console.log("[cleanup-worker] Cleaning up expired inventory reservations");
  
  // Simulate finding and cleaning expired reservations
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  const expiredReservations = Math.floor(Math.random() * 8); // 0-7 expired
  
  if (expiredReservations > 0) {
    console.log(`Found ${expiredReservations} expired inventory reservations`);
    // Simulate cleanup work
    await new Promise(resolve => setTimeout(resolve, expiredReservations * 10));
  }
  
  return {
    found: expiredReservations,
    cleaned: expiredReservations,
    status: "completed"
  };
}

async function archiveCompletedWorkflows() {
  console.log("[cleanup-worker] Archiving completed workflow instances");
  
  // Simulate finding workflows older than 24 hours
  await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
  
  const completedWorkflows = Math.floor(Math.random() * 12); // 0-11 workflows
  
  if (completedWorkflows > 0) {
    console.log(`Found ${completedWorkflows} completed workflows to archive`);
    // Simulate archival process
    await new Promise(resolve => setTimeout(resolve, completedWorkflows * 15));
  }
  
  return {
    found: completedWorkflows,
    archived: completedWorkflows,
    criteria: "completed > 24 hours ago",
    status: "completed"
  };
}

async function purgeOldQueueMessages() {
  console.log("[cleanup-worker] Purging old queue messages");
  
  // Simulate cleaning DLQ and expired messages
  await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 120));
  
  const deadLetterMessages = Math.floor(Math.random() * 5);
  const expiredMessages = Math.floor(Math.random() * 3);
  
  if (deadLetterMessages + expiredMessages > 0) {
    console.log(`Purging ${deadLetterMessages} dead letter messages and ${expiredMessages} expired messages`);
  }
  
  return {
    deadLetterMessages,
    expiredMessages,
    totalPurged: deadLetterMessages + expiredMessages,
    status: "completed"
  };
}

async function cleanupTemporaryData() {
  console.log("[cleanup-worker] Cleaning up temporary order data");
  
  // Simulate cleaning temp files, cache entries, etc.
  await new Promise(resolve => setTimeout(resolve, 120 + Math.random() * 80));
  
  const tempFiles = Math.floor(Math.random() * 15);
  const cacheEntries = Math.floor(Math.random() * 25);
  
  if (tempFiles + cacheEntries > 0) {
    console.log(`Cleaning ${tempFiles} temp files and ${cacheEntries} cache entries`);
  }
  
  return {
    tempFiles,
    cacheEntries,
    totalCleaned: tempFiles + cacheEntries,
    status: "completed"
  };
}