// Workflow definition: payment verification with external events
//
// This workflow demonstrates the waitForEvent pattern where a workflow
// pauses and waits for an external event (e.g., a webhook callback)
// before continuing execution.
//
// This is the Cloudflare Workers pattern for integrating with external
// systems like payment processors, approval systems, or third-party APIs.

export class PaymentWorkflow {
  async run(event, step) {
    // Step 1: Initialize the payment
    const payment = await step.do("initialize payment", async () => {
      const { amount, currency, customerEmail } = event.payload;

      console.log(`Initializing payment of ${amount} ${currency} for ${customerEmail}`);

      return {
        paymentId: `pay_${Date.now()}`,
        amount,
        currency: currency || "USD",
        customerEmail,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
    });

    // Step 2: Send payment request to external processor
    const processorResponse = await step.do(
      "submit to processor",
      {
        retries: {
          limit: 2,
          delay: "3 seconds",
          backoff: "linear",
        },
      },
      async () => {
        console.log(`Submitting payment ${payment.paymentId} to processor`);

        // In a real scenario, this would call a payment API
        // The processor returns a reference and expects a webhook callback
        return {
          processorRef: `proc_${Date.now()}`,
          webhookExpected: true,
          submittedAt: new Date().toISOString(),
        };
      }
    );

    // Step 3: Wait for payment confirmation webhook
    // This pauses the workflow until an external event is received
    // via instance.sendEvent({ type: "payment-confirmed", payload: {...} })
    const confirmation = await step.waitForEvent(
      "wait for payment confirmation",
      {
        type: "payment-confirmed",
        timeout: "1 hour",
      }
    );

    // Step 4: Process the confirmed payment
    const result = await step.do("finalize payment", async () => {
      console.log(`Payment ${payment.paymentId} confirmed by processor`);

      return {
        paymentId: payment.paymentId,
        processorRef: processorResponse.processorRef,
        confirmationData: confirmation,
        status: "completed",
        completedAt: new Date().toISOString(),
      };
    });

    // Step 5: Send receipt
    const receipt = await step.do("send receipt", async () => {
      console.log(`Sending receipt to ${payment.customerEmail}`);

      return {
        receiptId: `rcpt_${Date.now()}`,
        sentTo: payment.customerEmail,
        sentAt: new Date().toISOString(),
      };
    });

    return {
      payment: result,
      receipt,
      status: "success",
    };
  }
}

// HTTP handler: creates workflow instances and sends events
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /?instanceId=xxx - Check workflow instance status
    const instanceId = url.searchParams.get("instanceId");
    if (instanceId && request.method === "GET") {
      try {
        const instance = await env.PAYMENT_WORKFLOW.get(instanceId);
        return Response.json({
          id: instance.id,
          status: await instance.status(),
        });
      } catch (e) {
        return Response.json(
          { error: `Instance not found: ${e.message}` },
          { status: 404 }
        );
      }
    }

    // POST /webhook?instanceId=xxx - Send event to a waiting workflow
    if (path === "/webhook" && request.method === "POST") {
      const targetId = url.searchParams.get("instanceId");
      if (!targetId) {
        return Response.json(
          { error: "Missing instanceId query parameter" },
          { status: 400 }
        );
      }

      let payload;
      try {
        payload = await request.json();
      } catch {
        payload = { confirmed: true };
      }

      try {
        const instance = await env.PAYMENT_WORKFLOW.get(targetId);
        await instance.sendEvent({
          type: "payment-confirmed",
          payload,
        });

        return Response.json({
          message: "Event sent to workflow instance",
          instanceId: targetId,
          eventType: "payment-confirmed",
        });
      } catch (e) {
        return Response.json(
          { error: `Failed to send event: ${e.message}` },
          { status: 400 }
        );
      }
    }

    // POST / - Create a new workflow instance
    if (request.method === "POST") {
      let params;
      try {
        params = await request.json();
      } catch {
        params = {
          amount: 99.99,
          currency: "USD",
          customerEmail: "customer@example.com",
        };
      }

      const instance = await env.PAYMENT_WORKFLOW.create({ params });

      return Response.json({
        message: "Payment workflow started - waiting for confirmation webhook",
        instanceId: instance.id,
        checkStatus: `${url.origin}?instanceId=${instance.id}`,
        sendWebhook: `${url.origin}/webhook?instanceId=${instance.id}`,
      });
    }

    // GET / - Usage info
    return Response.json({
      name: "workflow-events",
      description: "Payment verification workflow with external events (waitForEvent)",
      endpoints: {
        createInstance: {
          method: "POST",
          path: "/",
          body: { amount: 99.99, currency: "USD", customerEmail: "customer@example.com" },
        },
        checkStatus: {
          method: "GET",
          path: "/?instanceId=<id>",
        },
        sendWebhook: {
          method: "POST",
          path: "/webhook?instanceId=<id>",
          body: { confirmed: true, transactionRef: "stripe_ch_xxx" },
          description: "Simulates a payment processor webhook callback",
        },
      },
      flow: [
        "1. POST / -> Creates payment workflow instance",
        "2. Workflow initializes payment and submits to processor",
        "3. Workflow pauses at waitForEvent('payment-confirmed')",
        "4. POST /webhook?instanceId=<id> -> Sends confirmation event",
        "5. Workflow resumes, finalizes payment, sends receipt",
      ],
    });
  },
};