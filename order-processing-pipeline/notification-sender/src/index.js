/**
 * Notification Sender Worker
 * 
 * Consumes messages from notification-queue and sends various types of notifications:
 * - Email notifications
 * - SMS notifications  
 * - Push notifications
 * 
 * Bindings:
 * - Consumes from: notification-queue
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        name: "notification-sender",
        version: "1.0.0",
        description: "Sends notifications based on queue messages",
        role: "Queue consumer for notification-queue",
        supported_types: [
          "payment_success",
          "order_shipped",
          "order_delivered", 
          "order_cancelled",
          "payment_failed"
        ],
        channels: ["email", "sms", "push"],
        note: "This worker processes notification messages automatically"
      });
    }
    
    return Response.json({ 
      error: "This worker is primarily a queue consumer. Check logs for notification activity." 
    }, { status: 404 });
  },

  /**
   * Queue handler - processes notification messages
   */
  async queue(batch, env) {
    console.log(`[notification-sender] Processing ${batch.messages.length} notifications`);

    for (const message of batch.messages) {
      try {
        const notification = message.body;
        console.log(`Sending ${notification.type} notification for order ${notification.orderId}`);

        // Validate notification data
        if (!notification.type || !notification.orderId) {
          throw new Error("Invalid notification: missing type or orderId");
        }
        
        if (!notification.customer?.email) {
          console.warn(`No customer email for order ${notification.orderId}, skipping email`);
        }

        // Process different notification types
        await sendNotification(notification);
        
        console.log(`✅ Notification sent successfully for order ${notification.orderId}`);
        message.ack();
        
      } catch (error) {
        console.error(`❌ Notification failed for message ${message.id}: ${error.message}`);
        
        // Determine retry strategy
        if (error.message.includes("Invalid notification") || 
            error.message.includes("malformed")) {
          // Permanent failures
          console.error(`Permanent notification failure, not retrying: ${error.message}`);
          message.ack(); // Remove from queue
        } else {
          // Temporary failures - retry
          console.log(`Temporary notification failure, will retry: ${error.message}`);
          message.retry();
        }
      }
    }
    
    console.log(`[notification-sender] Batch processing completed`);
  }
};

/**
 * Send notification based on type and customer preferences
 */
async function sendNotification(notification) {
  const { type, orderId, customer } = notification;
  
  // Simulate notification sending delay
  await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));
  
  // Simulate occasional delivery failures
  if (Math.random() < 0.02) { // 2% failure rate
    throw new Error("Notification service temporarily unavailable");
  }
  
  switch (type) {
    case "payment_success":
      await sendPaymentSuccessNotification(notification);
      break;
      
    case "order_shipped":
      await sendOrderShippedNotification(notification);
      break;
      
    case "order_delivered":
      await sendOrderDeliveredNotification(notification);
      break;
      
    case "order_cancelled":
      await sendOrderCancelledNotification(notification);
      break;
      
    case "payment_failed":
      await sendPaymentFailedNotification(notification);
      break;
      
    default:
      console.log(`📧 Generic notification for order ${orderId}: ${JSON.stringify(notification)}`);
  }
}

async function sendPaymentSuccessNotification(notification) {
  const { orderId, amount, transactionId, customer, last4 } = notification;
  
  // Send email
  if (customer?.email) {
    console.log(`📧 Email to ${customer.email}:`);
    console.log(`   Subject: Payment Confirmation - Order ${orderId}`);
    console.log(`   Body: Your payment of $${amount} has been successfully processed.`);
    console.log(`   Transaction ID: ${transactionId}`);
    if (last4) {
      console.log(`   Payment Method: Card ending in ${last4}`);
    }
  }
  
  // Send SMS
  if (customer?.phone) {
    console.log(`📱 SMS to ${customer.phone}:`);
    console.log(`   Message: Your payment of $${amount} for order ${orderId} has been processed. Transaction: ${transactionId}`);
  }
  
  // Send push notification
  console.log(`🔔 Push notification: Payment confirmed for order ${orderId}`);
}

async function sendOrderShippedNotification(notification) {
  const { orderId, trackingNumber, carrier, estimatedDelivery, customer } = notification;
  
  if (customer?.email) {
    console.log(`📧 Email to ${customer.email}:`);
    console.log(`   Subject: Order Shipped - ${orderId}`);
    console.log(`   Body: Your order has been shipped!`);
    console.log(`   Tracking: ${trackingNumber} via ${carrier}`);
    if (estimatedDelivery) {
      console.log(`   Estimated Delivery: ${new Date(estimatedDelivery).toLocaleDateString()}`);
    }
  }
  
  if (customer?.phone) {
    console.log(`📱 SMS to ${customer.phone}:`);
    console.log(`   Message: Order ${orderId} shipped! Track: ${trackingNumber}`);
  }
}

async function sendOrderDeliveredNotification(notification) {
  const { orderId, customer, deliveredAt } = notification;
  
  if (customer?.email) {
    console.log(`📧 Email to ${customer.email}:`);
    console.log(`   Subject: Order Delivered - ${orderId}`);
    console.log(`   Body: Your order has been successfully delivered.`);
    if (deliveredAt) {
      console.log(`   Delivered at: ${new Date(deliveredAt).toLocaleString()}`);
    }
  }
  
  console.log(`🔔 Push notification: Order ${orderId} delivered successfully!`);
}

async function sendOrderCancelledNotification(notification) {
  const { orderId, reason, customer, refundAmount } = notification;
  
  if (customer?.email) {
    console.log(`📧 Email to ${customer.email}:`);
    console.log(`   Subject: Order Cancelled - ${orderId}`);
    console.log(`   Body: Your order has been cancelled.`);
    if (reason) {
      console.log(`   Reason: ${reason}`);
    }
    if (refundAmount) {
      console.log(`   Refund: $${refundAmount} will be processed within 3-5 business days.`);
    }
  }
}

async function sendPaymentFailedNotification(notification) {
  const { orderId, reason, customer, amount } = notification;
  
  if (customer?.email) {
    console.log(`📧 Email to ${customer.email}:`);
    console.log(`   Subject: Payment Failed - Order ${orderId}`);
    console.log(`   Body: Payment of $${amount} failed.`);
    if (reason) {
      console.log(`   Reason: ${reason}`);
    }
    console.log(`   Please update your payment method to complete your order.`);
  }
  
  if (customer?.phone) {
    console.log(`📱 SMS to ${customer.phone}:`);
    console.log(`   Message: Payment failed for order ${orderId}. Please update payment method.`);
  }
}