/**
 * Payment Processor Worker
 * 
 * Consumes messages from payment-queue and processes payments.
 * After successful payment processing:
 * - Enqueues notification messages
 * - Sends workflow events for payment confirmation
 * 
 * Bindings:
 * - NOTIFICATION_QUEUE: Producer for notification-queue
 * - Consumes from: payment-queue
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        name: "payment-processor",
        version: "1.0.0", 
        description: "Processes payments from the payment queue and sends notifications",
        role: "Queue consumer for payment-queue",
        bindings: {
          notification_queue: "notification-queue (producer)",
          payment_queue: "payment-queue (consumer)"
        },
        note: "This worker processes messages automatically when they arrive in payment-queue"
      });
    }
    
    return Response.json({ 
      error: "This worker is primarily a queue consumer. Check logs for processing activity." 
    }, { status: 404 });
  },

  /**
   * Queue handler - processes payment messages
   */
  async queue(batch, env) {
    console.log(`[payment-processor] Processing batch of ${batch.messages.length} payments`);

    for (const message of batch.messages) {
      try {
        const paymentData = message.body;
        const { orderId, amount, customer, workflowInstanceId, items } = paymentData;
        
        console.log(`Processing payment of $${amount} for order ${orderId}`);
        
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
        
        // Simulate payment processing with occasional failures
        if (Math.random() < 0.05) { // 5% failure rate
          throw new Error("Payment gateway temporarily unavailable");
        }
        
        if (amount <= 0) {
          throw new Error("Invalid payment amount");
        }
        
        // Generate payment confirmation details
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const processedAt = new Date().toISOString();
        
        console.log(`Payment ${transactionId} processed successfully for order ${orderId}`);
        
        // Create notification message
        const notificationMessage = {
          type: "payment_success",
          orderId,
          transactionId,
          amount,
          customer,
          workflowInstanceId,
          items,
          processedAt,
          paymentMethod: "credit_card", // Simulate payment method
          last4: "1234", // Simulate card details
          enqueuedAt: new Date().toISOString()
        };
        
        // Enqueue notification
        await env.NOTIFICATION_QUEUE.send(notificationMessage);
        console.log(`Notification queued for order ${orderId}`);
        
        // TODO: Send workflow event for payment confirmation
        // This would require a workflow event API that we'll simulate for now
        console.log(`Payment confirmation event would be sent to workflow ${workflowInstanceId}`);
        
        // Mark message as successfully processed
        message.ack();
        
      } catch (error) {
        console.error(`Payment processing failed for message ${message.id}: ${error.message}`);
        
        // Determine if we should retry or fail permanently
        if (error.message.includes("Invalid payment amount") || 
            error.message.includes("customer") && error.message.includes("invalid")) {
          // Permanent failures - don't retry
          console.error(`Permanent failure, not retrying: ${error.message}`);
          message.ack(); // Remove from queue
        } else {
          // Temporary failures - retry
          console.log(`Temporary failure, will retry: ${error.message}`);
          message.retry();
        }
      }
    }
    
    console.log(`[payment-processor] Batch processing completed`);
  }
};