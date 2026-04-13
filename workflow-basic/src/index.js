// Workflow definition: multi-step document signing
//
// Cloudflare Workflows use a class-based API where the workflow extends
// WorkflowEntrypoint and defines a `run` method with durable steps.
//
// On FlameFlare, the runtime executes each step via the workflow engine,
// persisting state between steps for automatic retry and resumption.

export class DocumentSigningWorkflow {
  async run(event, step) {
    // Step 1: Validate and upload document
    const document = await step.do("upload document", async () => {
      const { title, author, signers } = event.payload;

      if (!title || !signers || signers.length === 0) {
        throw new Error("Invalid document: missing title or signers");
      }

      return {
        documentId: `doc_${Date.now()}`,
        title,
        author: author || "Unknown",
        signers,
        pageCount: Math.floor(Math.random() * 20) + 1,
        uploadedAt: new Date().toISOString(),
      };
    });

    // Step 2: Prepare signing envelope (with retries for transient failures)
    const envelope = await step.do(
      "prepare envelope",
      {
        retries: {
          limit: 3,
          delay: "5 seconds",
          backoff: "exponential",
        },
        timeout: "30 seconds",
      },
      async () => {
        console.log(`Preparing envelope for "${document.title}" with ${document.signers.length} signers`);

        const signerLinks = document.signers.map((signer, i) => ({
          email: signer.email,
          name: signer.name,
          signingUrl: `https://sign.example.com/${document.documentId}/signer/${i}`,
          order: i + 1,
        }));

        return {
          envelopeId: `env_${Date.now()}`,
          documentId: document.documentId,
          signerLinks,
          status: "created",
          preparedAt: new Date().toISOString(),
        };
      }
    );

    // Step 3: Wait for signatures to be collected (simulates processing time)
    await step.sleep("wait for signing window", "10 seconds");

    // Step 4: Request signatures from all parties (with retries)
    const signatures = await step.do(
      "request signatures",
      {
        retries: {
          limit: 2,
          delay: "10 seconds",
          backoff: "linear",
        },
      },
      async () => {
        console.log(`Requesting signatures for envelope ${envelope.envelopeId}`);

        const collected = envelope.signerLinks.map((signer) => ({
          email: signer.email,
          name: signer.name,
          signedAt: new Date().toISOString(),
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
        }));

        return {
          allSigned: true,
          signatures: collected,
          completedAt: new Date().toISOString(),
        };
      }
    );

    // Step 5: Finalize and seal the document
    const sealed = await step.do("finalize document", async () => {
      console.log(`Sealing document "${document.title}" with ${signatures.signatures.length} signatures`);

      return {
        certificateId: `cert_${Date.now()}`,
        sealedAt: new Date().toISOString(),
        downloadUrl: `https://docs.example.com/${document.documentId}/signed.pdf`,
        auditTrail: `https://docs.example.com/${document.documentId}/audit`,
      };
    });

    // Return the final workflow output
    return {
      documentId: document.documentId,
      title: document.title,
      status: "completed",
      envelope,
      signatures,
      sealed,
    };
  }
}

// HTTP handler: creates and manages workflow instances
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // GET /?instanceId=xxx - Check signing workflow status
    const instanceId = url.searchParams.get("instanceId");
    if (instanceId) {
      try {
        const instance = await env.SIGNING_WORKFLOW.get(instanceId);
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

    // POST / - Create a new signing workflow instance
    if (request.method === "POST") {
      let params;
      try {
        params = await request.json();
      } catch {
        params = {
          title: "Quarterly Report Q4 2024",
          author: "Jane Doe",
          signers: [
            { name: "Alice Smith", email: "alice@example.com" },
            { name: "Bob Johnson", email: "bob@example.com" },
          ],
        };
      }

      const instance = await env.SIGNING_WORKFLOW.create({ params });

      return Response.json({
        message: "Signing workflow created",
        instanceId: instance.id,
        checkStatus: `${url.origin}?instanceId=${instance.id}`,
      });
    }

    // GET / - Usage info
    return Response.json({
      name: "workflow-basic",
      description: "Multi-step document signing workflow",
      usage: {
        createInstance: "POST / with JSON body (or POST / for default document)",
        checkStatus: "GET /?instanceId=<id>",
      },
      example: {
        title: "Partnership Agreement",
        author: "Legal Team",
        signers: [
          { name: "Alice Smith", email: "alice@example.com" },
          { name: "Bob Johnson", email: "bob@example.com" },
        ],
      },
    });
  },
};