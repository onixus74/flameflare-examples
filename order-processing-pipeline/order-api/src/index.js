/**
 * Order API Worker - Main entry point for the order processing pipeline
 * 
 * Features:
 * - Creates new orders and starts workflow instances
 * - Enqueues payment processing tasks
 * - Provides order status checking
 * - Integrates with cleanup service via service binding
 * 
 * Bindings:
 * - PAYMENT_QUEUE: Producer for payment-queue
 * - ORDER_WORKFLOW: Workflow binding to order-fulfillment
 * - CLEANUP_SERVICE: Service binding to cleanup-worker
 * - ORDER_API_KEY: Environment variable for API authentication
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    try {
      // POST /order - Create new order and start processing
      if (request.method === "POST" && url.pathname === "/order") {
        return await handleCreateOrder(request, env);
      }
      
      // GET /status - Check order status via workflow instance
      if (request.method === "GET" && url.pathname === "/status") {
        const orderId = url.searchParams.get("orderId");
        const instanceId = url.searchParams.get("instanceId");
        
        if (!orderId && !instanceId) {
          return Response.json({ 
            error: "Missing orderId or instanceId parameter" 
          }, { status: 400 });
        }
        
        return await handleOrderStatus(orderId, instanceId, env);
      }
      
      // POST /cleanup - Trigger cleanup service via service binding
      if (request.method === "POST" && url.pathname === "/cleanup") {
        return await handleCleanupTrigger(env);
      }
      
      // GET / - API usage information
      if (request.method === "GET" && url.pathname === "/") {
        return Response.json({
          name: "order-api",
          version: "1.0.0",
          description: "Order processing pipeline entry point",
          endpoints: {
            "POST /order": "Create new order and start processing",
            "GET /status?orderId=xxx": "Check order status",
            "GET /status?instanceId=xxx": "Check workflow instance status", 
            "POST /cleanup": "Trigger manual cleanup"
          },
          bindings: {
            payment_queue: "payment-queue",
            workflow: "order-fulfillment",
            cleanup_service: "cleanup-worker",
            api_key: env.ORDER_API_KEY ? "configured" : "missing"
          }
        });
      }
      
      return Response.json({ 
        error: "Not found" 
      }, { status: 404 });
      
    } catch (error) {
      console.error("Order API error:", error);
      return Response.json({ 
        error: error.message,
        stack: error.stack 
      }, { status: 500 });
    }
  }
};

async function handleCreateOrder(request, env) {
  let orderData;
  
  try {
    orderData = await request.json();
  } catch (error) {
    // If no JSON body provided, create a default order
    orderData = {
      orderId: `order_${Date.now()}`,
      items: [
        { name: "Sample Widget", price: 29.99, quantity: 1 },
        { name: "Demo Gadget", price: 15.99, quantity: 2 }
      ],
      customer: {
        name: "John Doe",
        email: "john.doe@example.com",
        phone: "+1-555-0123"
      }
    };
  }
  
  // Ensure orderId exists
  if (!orderData.orderId) {
    orderData.orderId = `order_${Date.now()}`;
  }
  
  console.log(`Creating order ${orderData.orderId}`);
  
  // Calculate total amount
  const totalAmount = orderData.items?.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0) || 0;
  
  try {
    // Start the order fulfillment workflow
    let instanceId = null;
    let workflowStarted = false;
    
    if (env.ORDER_WORKFLOW) {
      try {
        const workflowInstance = await env.ORDER_WORKFLOW.create({
          params: {
            orderId: orderData.orderId,
            items: orderData.items || [],
            customer: orderData.customer || {},
            totalAmount,
            createdAt: new Date().toISOString()
          }
        });
        instanceId = workflowInstance?.id || null;
        workflowStarted = !!instanceId;
        console.log(`Started workflow instance: ${instanceId}`);
      } catch (wfError) {
        console.error(`Workflow creation failed (non-fatal): ${wfError.message}`);
      }
    }
    
    // Enqueue payment processing
    const paymentMessage = {
      orderId: orderData.orderId,
      amount: totalAmount,
      customer: orderData.customer,
      workflowInstanceId: instanceId,
      items: orderData.items,
      enqueuedAt: new Date().toISOString()
    };
    
    await env.PAYMENT_QUEUE.send(paymentMessage);
    console.log(`Payment queued for order ${orderData.orderId}`);
    
    return Response.json({
      success: true,
      orderId: orderData.orderId,
      instanceId,
      totalAmount,
      status: "processing",
      message: "Order created and processing started",
      paymentQueued: true,
      workflowStarted
    });
    
  } catch (error) {
    console.error(`Failed to create order ${orderData.orderId}:`, error);
    return Response.json({
      success: false,
      orderId: orderData.orderId,
      error: error.message
    }, { status: 500 });
  }
}

async function handleOrderStatus(orderId, instanceId, env) {
  try {
    let workflowInfo;
    
    if (instanceId) {
      // Get specific workflow instance
      workflowInfo = await env.ORDER_WORKFLOW.get(instanceId);
    } else {
      // If only orderId provided, we'd need to search instances
      // For demo purposes, return a helpful message
      return Response.json({
        orderId,
        message: "Please provide instanceId for detailed status. Check order creation response for instanceId.",
        tip: "Use GET /status?instanceId=xxx for detailed workflow status"
      });
    }
    
    if (!workflowInfo) {
      return Response.json({
        orderId,
        instanceId, 
        error: "Workflow instance not found"
      }, { status: 404 });
    }
    
    return Response.json({
      orderId: orderId || workflowInfo.params?.orderId,
      instanceId,
      status: workflowInfo.status,
      output: workflowInfo.output,
      error: workflowInfo.error,
      steps: workflowInfo.steps,
      createdAt: workflowInfo.createdAt,
      updatedAt: workflowInfo.updatedAt
    });
    
  } catch (error) {
    console.error("Failed to get order status:", error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}

async function handleCleanupTrigger(env) {
  try {
    // Call cleanup service via service binding
    if (!env.CLEANUP_SERVICE) {
      return Response.json({
        error: "Cleanup service binding not configured"
      }, { status: 500 });
    }
    
    console.log("Triggering cleanup via service binding");
    
    const cleanupRequest = new Request("http://cleanup-worker/__service_call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        triggeredBy: "order-api",
        triggerTime: new Date().toISOString()
      })
    });
    
    const response = await env.CLEANUP_SERVICE.fetch(cleanupRequest);
    const result = await response.json();
    
    return Response.json({
      message: "Cleanup triggered successfully",
      result
    });
    
  } catch (error) {
    console.error("Failed to trigger cleanup:", error);
    return Response.json({
      error: error.message
    }, { status: 500 });
  }
}

/**
 * Order Fulfillment Workflow Class
 * 
 * Implements a multi-step order processing workflow with:
 * - Order validation
 * - Inventory reservation (with retries)
 * - Payment confirmation waiting
 * - Shipment creation
 * - Final confirmation
 */
export class OrderFulfillmentWorkflow {
  async run(event, step) {
    console.log(`Starting order fulfillment workflow for order ${event.payload?.orderId}`);
    
    // Step 1: Validate order
    const order = await step.do("validate-order", async () => {
      const { orderId, items, customer, totalAmount } = event.payload;
      
      // Basic validation
      if (!orderId || !items?.length) {
        throw new Error("Invalid order: missing orderId or items");
      }
      
      if (!customer?.email) {
        throw new Error("Invalid order: customer email required");
      }
      
      // Calculate total if not provided
      const calculatedTotal = items.reduce((sum, item) => 
        sum + (item.price * item.quantity), 0);
      
      const validatedOrder = {
        orderId,
        customer,
        items,
        totalAmount: totalAmount || calculatedTotal,
        validatedAt: new Date().toISOString()
      };
      
      console.log(`Order ${orderId} validated with total $${validatedOrder.totalAmount}`);
      return validatedOrder;
    });

    // Step 2: Reserve inventory (with exponential backoff retries)
    const reservation = await step.do("reserve-inventory", {
      retries: { 
        limit: 3, 
        delay: "2 seconds", 
        backoff: "exponential" 
      }
    }, async () => {
      console.log(`Reserving inventory for ${order.items.length} items`);
      
      // Simulate inventory check
      for (const item of order.items) {
        if (Math.random() < 0.1) { // 10% chance of inventory issue
          throw new Error(`Insufficient inventory for ${item.name}`);
        }
      }
      
      const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        reservationId,
        items: order.items,
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry
      };
    });

    // Step 3: Wait for payment confirmation
    // The payment processor will send a payment_confirmed event
    const paymentEvent = await step.waitForEvent("wait-for-payment", {
      timeout: "5 minutes",
      type: "payment_confirmed"
    });
    
    console.log(`Payment confirmed for order ${order.orderId}: ${JSON.stringify(paymentEvent)}`);

    // Step 4: Create shipment (with linear backoff retries)
    const shipment = await step.do("create-shipment", {
      retries: { 
        limit: 2, 
        delay: "5 seconds", 
        backoff: "linear" 
      }
    }, async () => {
      console.log(`Creating shipment for order ${order.orderId}`);
      
      // Simulate shipment creation
      if (Math.random() < 0.05) { // 5% chance of shipping issue
        throw new Error("Shipping service temporarily unavailable");
      }
      
      const trackingNumber = `SHIP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
      
      return {
        trackingNumber,
        carrier: "FastShip Express",
        estimatedDelivery: estimatedDelivery.toISOString(),
        shippingAddress: order.customer.address || "Customer provided address",
        createdAt: new Date().toISOString()
      };
    });

    // Step 5: Send final confirmation
    const confirmation = await step.do("send-confirmation", async () => {
      console.log(`Order ${order.orderId} fulfilled — notifying ${order.customer.email}`);
      
      // This could trigger another notification queue message if needed
      const confirmationData = {
        orderId: order.orderId,
        customer: order.customer,
        trackingNumber: shipment.trackingNumber,
        estimatedDelivery: shipment.estimatedDelivery,
        notifiedAt: new Date().toISOString(),
        channel: "email"
      };
      
      console.log(`Confirmation sent to ${order.customer.email}`);
      return confirmationData;
    });

    // Return final workflow result
    const result = {
      orderId: order.orderId,
      status: "fulfilled",
      order,
      reservation,
      payment: paymentEvent,
      shipment,
      confirmation,
      completedAt: new Date().toISOString()
    };
    
    console.log(`Order fulfillment workflow completed for ${order.orderId}`);
    return result;
  }
}