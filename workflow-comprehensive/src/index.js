// ============================================================================
// Comprehensive Workflow Example: User Onboarding Pipeline
//
// This example demonstrates EVERY capability of the Cloudflare Workers
// Workflows API in a single, realistic scenario.
//
// Workflow features demonstrated:
//   step.do(name, callback)              — basic durable step
//   step.do(name, config, callback)      — step with retry/timeout config
//   step.sleep(name, duration)           — relative sleep
//   step.sleepUntil(name, timestamp)     — sleep until a specific date
//   step.waitForEvent(name, {type, timeout}) — pause for external event
//   Promise.all([step.do, step.do])      — parallel steps
//   Conditional branching (if/else)      — based on step output
//   Dynamic step loops (for..of)         — steps created from data
//   try/catch around steps               — error recovery & cleanup
//   NonRetryableError                    — force immediate failure
//   Retry backoff strategies             — exponential, linear, constant
//   Return value from run()              — final workflow output
//
// Instance management (fetch handler):
//   env.BINDING.create({id, params})     — custom instance ID
//   env.BINDING.get(id)                  — retrieve instance
//   instance.status()                    — query status
//   instance.sendEvent({type, payload})  — deliver event
//   instance.terminate()                 — stop execution
//   instance.pause() / instance.resume() — suspend/continue
//   instance.restart()                   — restart from scratch
// ============================================================================

// ---------------------------------------------------------------------------
// Simulates a NonRetryableError.
// On Cloudflare: import { NonRetryableError } from "cloudflare:workflows";
// On FlameFlare the executor handles this server-side, but the pattern is
// identical from the worker author's perspective.
// ---------------------------------------------------------------------------
class NonRetryableError extends Error {
  constructor(message) {
    super(message);
    this.name = "NonRetryableError";
  }
}

// ============================================================================
// WORKFLOW CLASS
// ============================================================================
export class OnboardingWorkflow {
  async run(event, step) {
    // ------------------------------------------------------------------
    // 1. VALIDATE USER DATA — basic step.do
    //    Demonstrates: reading event.payload, returning persisted state
    // ------------------------------------------------------------------
    const user = await step.do("validate user data", async () => {
      const { userId, email, name, tier } = event.payload;

      if (!userId || !email) {
        throw new NonRetryableError(
          "Missing required fields: userId and email are required"
        );
      }

      return {
        userId,
        email,
        name: name || "New User",
        tier: tier || "free", // "free" or "premium"
        validatedAt: new Date().toISOString(),
      };
    });

    // ------------------------------------------------------------------
    // 2. PARALLEL COMPLIANCE CHECKS — Promise.all with step.do
    //    Demonstrates: running multiple steps concurrently
    // ------------------------------------------------------------------
    const [kycResult, fraudResult] = await Promise.all([
      step.do(
        "run KYC check",
        {
          retries: { limit: 3, delay: "2 seconds", backoff: "exponential" },
          timeout: "20 seconds",
        },
        async () => {
          console.log(`KYC check for user ${user.userId}`);
          // Simulate a KYC API call
          return {
            passed: true,
            riskScore: 12,
            checkedAt: new Date().toISOString(),
          };
        }
      ),

      step.do(
        "run fraud detection",
        {
          retries: { limit: 2, delay: "3 seconds", backoff: "linear" },
          timeout: "15 seconds",
        },
        async () => {
          console.log(`Fraud detection for user ${user.userId}`);
          // Simulate a fraud-check API call
          return {
            passed: true,
            confidence: 0.97,
            checkedAt: new Date().toISOString(),
          };
        }
      ),
    ]);

    // ------------------------------------------------------------------
    // 3. CONDITIONAL BRANCHING — if/else based on step output
    //    Demonstrates: deterministic branching on persisted state
    // ------------------------------------------------------------------
    let tierSetup;
    if (user.tier === "premium") {
      tierSetup = await step.do("configure premium tier", async () => {
        console.log(`Setting up premium features for ${user.email}`);
        return {
          tier: "premium",
          features: ["priority-support", "advanced-analytics", "custom-domain", "sla-99.99"],
          quotaMultiplier: 10,
        };
      });
    } else {
      tierSetup = await step.do("configure free tier", async () => {
        console.log(`Setting up free tier for ${user.email}`);
        return {
          tier: "free",
          features: ["basic-support", "standard-analytics"],
          quotaMultiplier: 1,
        };
      });
    }

    // ------------------------------------------------------------------
    // 4. WAIT FOR EMAIL VERIFICATION — waitForEvent with try/catch
    //    Demonstrates: external event, timeout handling, error recovery
    // ------------------------------------------------------------------
    let emailVerified = false;
    try {
      const verificationEvent = await step.waitForEvent(
        "wait for email verification",
        { type: "email-verified", timeout: "30 minutes" }
      );
      emailVerified = true;
      console.log(`Email verified for ${user.email}: ${JSON.stringify(verificationEvent)}`);
    } catch (e) {
      // Timeout — user didn't verify in time. Continue with unverified state.
      console.log(`Email verification timed out for ${user.email}, continuing unverified`);
    }

    // ------------------------------------------------------------------
    // 5. CONDITIONAL WAIT — second waitForEvent (premium only)
    //    Demonstrates: multiple waitForEvent calls, conditional events
    // ------------------------------------------------------------------
    let adminApproved = true; // free users are auto-approved
    if (user.tier === "premium") {
      try {
        const approvalEvent = await step.waitForEvent(
          "wait for admin approval",
          { type: "admin-approved", timeout: "24 hours" }
        );
        console.log(`Admin approved premium for ${user.userId}: ${JSON.stringify(approvalEvent)}`);
      } catch (e) {
        adminApproved = false;
        console.log(`Admin approval timed out for premium user ${user.userId}`);
      }
    }

    // ------------------------------------------------------------------
    // 6. RELATIVE SLEEP — step.sleep
    //    Demonstrates: pausing the workflow for a relative duration
    // ------------------------------------------------------------------
    await step.sleep("cool-down period", "5 seconds");

    // ------------------------------------------------------------------
    // 7. SLEEP UNTIL — step.sleepUntil
    //    Demonstrates: sleeping until a specific timestamp
    //    (Here we compute a date 10 seconds in the future as a demo)
    // ------------------------------------------------------------------
    const activationDate = new Date(Date.now() + 10 * 1000); // 10s from now
    await step.sleepUntil("wait for activation date", activationDate);

    // ------------------------------------------------------------------
    // 8. PROVISION RESOURCES WITH ERROR HANDLING — try/catch + NonRetryableError
    //    Demonstrates: catching step failures, cleanup steps, NonRetryableError
    // ------------------------------------------------------------------
    let provisioningResult;
    try {
      provisioningResult = await step.do(
        "provision account resources",
        {
          retries: { limit: 2, delay: "1 second", backoff: "constant" },
          timeout: "30 seconds",
        },
        async () => {
          console.log(`Provisioning resources for ${user.userId}`);

          // Simulate checking for a permanent failure condition
          if (user.email.endsWith("@blocked.example")) {
            throw new NonRetryableError(
              "Domain is permanently blocked — cannot provision"
            );
          }

          return {
            accountId: `acct_${Date.now()}`,
            region: "us-east-1",
            provisionedAt: new Date().toISOString(),
          };
        }
      );
    } catch (e) {
      // Step failed after retries (or NonRetryableError was thrown).
      // Run a cleanup step instead of letting the whole workflow fail.
      await step.do("cleanup after provisioning failure", async () => {
        console.log(`Cleanup: provisioning failed for ${user.userId}: ${e.message}`);
        return { cleanedUp: true, reason: e.message };
      });

      // Return early with an error result
      return {
        userId: user.userId,
        status: "failed",
        error: `Provisioning failed: ${e.message}`,
        compliance: { kyc: kycResult, fraud: fraudResult },
      };
    }

    // ------------------------------------------------------------------
    // 9. DYNAMIC STEP LOOP — creating steps from a list
    //    Demonstrates: deterministic dynamic step names from data
    // ------------------------------------------------------------------
    const featureResults = [];
    for (const feature of tierSetup.features) {
      const result = await step.do(`enable feature: ${feature}`, async () => {
        console.log(`Enabling ${feature} for ${user.userId}`);
        return {
          feature,
          enabled: true,
          enabledAt: new Date().toISOString(),
        };
      });
      featureResults.push(result);
    }

    // ------------------------------------------------------------------
    // 10. SEND WELCOME NOTIFICATION — step with constant backoff
    //     Demonstrates: "constant" retry strategy
    // ------------------------------------------------------------------
    const notification = await step.do(
      "send welcome notification",
      {
        retries: { limit: 5, delay: "2 seconds", backoff: "constant" },
      },
      async () => {
        console.log(`Sending welcome email to ${user.email}`);
        return {
          channel: "email",
          recipient: user.email,
          subject: `Welcome to FlameFlare, ${user.name}!`,
          sentAt: new Date().toISOString(),
        };
      }
    );

    // ------------------------------------------------------------------
    // RETURN FINAL OUTPUT — available via instance.status().output
    // ------------------------------------------------------------------
    return {
      userId: user.userId,
      status: "onboarded",
      tier: tierSetup.tier,
      emailVerified,
      adminApproved,
      compliance: {
        kyc: kycResult,
        fraud: fraudResult,
      },
      provisioning: provisioningResult,
      features: featureResults,
      notification,
    };
  }
}

// ============================================================================
// FETCH HANDLER — exercises all instance management APIs
// ============================================================================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const instanceId = url.searchParams.get("instanceId");

    // ---- Instance management routes (require instanceId) ----

    if (instanceId) {
      try {
        const instance = await env.ONBOARDING_WORKFLOW.get(instanceId);

        // GET ?instanceId=xxx — check status
        if (request.method === "GET") {
          return Response.json({
            id: instance.id,
            status: await instance.status(),
          });
        }

        // POST /verify-email?instanceId=xxx — send email verification event
        if (path === "/verify-email" && request.method === "POST") {
          await instance.sendEvent({
            type: "email-verified",
            payload: { verifiedAt: new Date().toISOString(), ...(await safeJson(request)) },
          });
          return Response.json({ message: "Email verification event sent", instanceId });
        }

        // POST /admin-approve?instanceId=xxx — send admin approval event
        if (path === "/admin-approve" && request.method === "POST") {
          await instance.sendEvent({
            type: "admin-approved",
            payload: { approvedBy: "admin", approvedAt: new Date().toISOString(), ...(await safeJson(request)) },
          });
          return Response.json({ message: "Admin approval event sent", instanceId });
        }

        // POST /terminate?instanceId=xxx — terminate instance
        if (path === "/terminate" && request.method === "POST") {
          await instance.terminate();
          return Response.json({ message: "Instance terminated", instanceId });
        }

        // POST /pause?instanceId=xxx — pause instance
        if (path === "/pause" && request.method === "POST") {
          await instance.pause();
          return Response.json({ message: "Instance paused", instanceId });
        }

        // POST /resume?instanceId=xxx — resume instance
        if (path === "/resume" && request.method === "POST") {
          await instance.resume();
          return Response.json({ message: "Instance resumed", instanceId });
        }

        // POST /restart?instanceId=xxx — restart instance
        if (path === "/restart" && request.method === "POST") {
          await instance.restart();
          return Response.json({ message: "Instance restarted", instanceId });
        }

      } catch (e) {
        return Response.json(
          { error: e.message || "Instance operation failed" },
          { status: 400 }
        );
      }
    }

    // POST /batch — create multiple onboarding instances at once
    if (path === "/batch" && request.method === "POST") {
      let body = await safeJson(request);
      const batch = body.batch || [
        { params: { userId: `user_${Date.now()}_1`, email: "batch1@example.com", name: "Batch User 1", tier: "free" } },
        { params: { userId: `user_${Date.now()}_2`, email: "batch2@example.com", name: "Batch User 2", tier: "premium" } },
      ];

      const instances = await env.ONBOARDING_WORKFLOW.createBatch(batch);

      return Response.json({
        message: `Created ${instances.length} onboarding instances`,
        instances: instances.map(inst => ({
          id: inst.id,
          checkStatus: `${url.origin}?instanceId=${inst.id}`,
        })),
      });
    }

    // ---- POST / — create a new workflow instance ----

    if (request.method === "POST") {
      let body = await safeJson(request);

      const params = {
        userId: body.userId || `user_${Date.now()}`,
        email: body.email || "new-user@example.com",
        name: body.name || "New User",
        tier: body.tier || "free",
      };

      // Demonstrates: create() with a custom instance ID
      const customId = body.instanceId || `onboard-${params.userId}`;

      const instance = await env.ONBOARDING_WORKFLOW.create({
        id: customId,
        params,
      });

      const base = url.origin;
      return Response.json({
        message: "Onboarding workflow started",
        instanceId: instance.id,
        endpoints: {
          status:        `GET  ${base}?instanceId=${instance.id}`,
          verifyEmail:   `POST ${base}/verify-email?instanceId=${instance.id}`,
          adminApprove:  `POST ${base}/admin-approve?instanceId=${instance.id}`,
          terminate:     `POST ${base}/terminate?instanceId=${instance.id}`,
          pause:         `POST ${base}/pause?instanceId=${instance.id}`,
          resume:        `POST ${base}/resume?instanceId=${instance.id}`,
          restart:       `POST ${base}/restart?instanceId=${instance.id}`,
        },
      });
    }

    // ---- GET / — usage info ----

    return Response.json({
      name: "workflow-comprehensive",
      description: "User onboarding pipeline — demonstrates every Cloudflare Workflow capability",
      workflowFeatures: {
        "step.do":              "Basic durable step with persisted return value",
        "step.do + config":     "Step with retries (exponential/linear/constant), timeout",
        "step.sleep":           "Relative sleep ('5 seconds')",
        "step.sleepUntil":      "Sleep until a specific Date/timestamp",
        "step.waitForEvent":    "Pause for external event with timeout + try/catch",
        "Promise.all":          "Parallel step execution",
        "conditional branching":"if/else based on step output (free vs premium tier)",
        "dynamic loop":         "for..of creating steps from a list of features",
        "try/catch":            "Error recovery with cleanup steps",
        "NonRetryableError":    "Force immediate failure (e.g. blocked domain)",
        "return from run()":    "Final workflow output available via status()",
      },
      instanceManagement: {
        "create({id, params})": "Custom instance ID",
        "get(id)":              "Retrieve existing instance",
        "status()":             "Query instance state, steps, output",
        "sendEvent()":          "Deliver event to waiting step",
        "terminate()":          "Stop execution immediately",
        "pause() / resume()":   "Suspend and continue",
        "restart()":            "Restart from the beginning",
      },
      endpoints: {
        createInstance:  { method: "POST", path: "/" },
        batchCreate:     { method: "POST", path: "/batch" },
        checkStatus:     { method: "GET",  path: "/?instanceId=<id>" },
        verifyEmail:     { method: "POST", path: "/verify-email?instanceId=<id>" },
        adminApprove:    { method: "POST", path: "/admin-approve?instanceId=<id>" },
        terminate:       { method: "POST", path: "/terminate?instanceId=<id>" },
        pause:           { method: "POST", path: "/pause?instanceId=<id>" },
        resume:          { method: "POST", path: "/resume?instanceId=<id>" },
        restart:         { method: "POST", path: "/restart?instanceId=<id>" },
      },
      examplePayloads: {
        freeUser:    { userId: "user_42", email: "alice@example.com", name: "Alice", tier: "free" },
        premiumUser: { userId: "user_99", email: "bob@corp.com",     name: "Bob",   tier: "premium" },
      },
    });
  },
};

// Helper: safely parse JSON body, return {} if empty/invalid
async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
