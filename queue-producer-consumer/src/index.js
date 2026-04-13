export default {
  // HTTP handler: produces messages to the queue
  async fetch(request, env, ctx) {
    if (request.method === "POST") {
      const body = await request.json();
      
      // Send message to queue
      await env.TASK_QUEUE.send({
        type: "process_task",
        data: body,
        timestamp: new Date().toISOString(),
      });

      return Response.json({
        status: "queued",
        message: "Task has been added to the queue",
      });
    }

    return Response.json({
      usage: "POST a JSON body to queue a task",
      example: { task: "send_email", to: "user@example.com" },
    });
  },

  // Queue consumer: processes messages from the queue
  async queue(batch, env) {
    console.log(`Processing batch of ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        console.log(`Processing: ${JSON.stringify(message.body)}`);
        
        // Process the message
        await processTask(message.body);

        // Acknowledge successful processing
        message.ack();
      } catch (error) {
        console.error(`Failed to process message: ${error.message}`);
        // Message will be retried
        message.retry();
      }
    }
  },
};

async function processTask(task) {
  // Simulate task processing
  console.log(`Task type: ${task.type}`);
  console.log(`Task data: ${JSON.stringify(task.data)}`);
}