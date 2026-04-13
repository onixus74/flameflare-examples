// ============================================================================
// Parallel Workflow Example: Data Pipeline with Fan-Out/Fan-In
//
// Demonstrates NEW FlameFlare workflow features:
//   - Promise.all with step.do()     — true parallel step execution
//   - ctx.attempt                    — retry attempt tracking
//   - createBatch()                  — batch instance creation
//   - WorkflowEntrypoint             — base class with this.env
//   - Dynamic parallel fan-out       — data-driven parallelism
// ============================================================================

// WorkflowEntrypoint base class (provided by FlameFlare runtime)
// In a real Cloudflare worker: import { WorkflowEntrypoint } from "cloudflare:workflows";

export class DataPipelineWorkflow {
  async run(event, step) {
    const { sources, outputFormat } = event.payload;
    const sourceList = sources || ["api", "database", "cache"];

    // ------------------------------------------------------------------
    // 1. PARALLEL DATA FETCH — fan out to multiple sources simultaneously
    //    Demonstrates: Promise.all with step.do for true parallel execution
    // ------------------------------------------------------------------
    const fetchResults = await Promise.all(
      sourceList.map((source) =>
        step.do(`fetch from ${source}`, async (ctx) => {
          // ctx.attempt tracks retry attempts (1-indexed)
          console.log(
            `Fetching from ${source} (attempt ${ctx.attempt})`
          );

          return {
            source,
            records: Math.floor(Math.random() * 100) + 10,
            fetchedAt: new Date().toISOString(),
            attempt: ctx.attempt,
          };
        })
      )
    );

    // ------------------------------------------------------------------
    // 2. PARALLEL TRANSFORM — process each source's data concurrently
    //    Demonstrates: another fan-out based on previous step results
    // ------------------------------------------------------------------
    const transformResults = await Promise.all(
      fetchResults.map((data) =>
        step.do(
          `transform ${data.source} data`,
          {
            retries: { limit: 2, delay: "1 second", backoff: "exponential" },
            timeout: "15 seconds",
          },
          async (ctx) => {
            console.log(
              `Transforming ${data.records} records from ${data.source} (attempt ${ctx.attempt})`
            );

            return {
              source: data.source,
              recordsIn: data.records,
              recordsOut: data.records * 2, // simulate enrichment
              format: outputFormat || "json",
              transformedAt: new Date().toISOString(),
            };
          }
        )
      )
    );

    // ------------------------------------------------------------------
    // 3. AGGREGATE — sequential step that combines all parallel results
    //    Demonstrates: fan-in after parallel processing
    // ------------------------------------------------------------------
    const aggregated = await step.do("aggregate results", async () => {
      const totalIn = transformResults.reduce((sum, r) => sum + r.recordsIn, 0);
      const totalOut = transformResults.reduce(
        (sum, r) => sum + r.recordsOut,
        0
      );

      return {
        sourcesProcessed: transformResults.length,
        totalRecordsIn: totalIn,
        totalRecordsOut: totalOut,
        aggregatedAt: new Date().toISOString(),
      };
    });

    // ------------------------------------------------------------------
    // 4. PARALLEL OUTPUT — write results to multiple destinations
    //    Demonstrates: final fan-out for output
    // ------------------------------------------------------------------
    const destinations = ["primary-store", "analytics", "backup"];
    const writeResults = await Promise.all(
      destinations.map((dest) =>
        step.do(`write to ${dest}`, async (ctx) => {
          console.log(
            `Writing ${aggregated.totalRecordsOut} records to ${dest} (attempt ${ctx.attempt})`
          );

          return {
            destination: dest,
            recordsWritten: aggregated.totalRecordsOut,
            writtenAt: new Date().toISOString(),
          };
        })
      )
    );

    // ------------------------------------------------------------------
    // RETURN — final pipeline output
    // ------------------------------------------------------------------
    return {
      status: "completed",
      pipeline: {
        sources: fetchResults,
        transforms: transformResults,
        aggregation: aggregated,
        outputs: writeResults,
      },
      summary: {
        sourcesProcessed: aggregated.sourcesProcessed,
        totalRecordsProcessed: aggregated.totalRecordsOut,
        destinationsWritten: writeResults.length,
        completedAt: new Date().toISOString(),
      },
    };
  }
}

// ============================================================================
// FETCH HANDLER — demonstrates createBatch and standard operations
// ============================================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const instanceId = url.searchParams.get("instanceId");

    // GET ?instanceId=xxx — check instance status
    if (instanceId && request.method === "GET") {
      try {
        const instance = await env.DATA_PIPELINE.get(instanceId);
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

    // POST /batch — create multiple pipeline instances at once
    if (path === "/batch" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        body = {};
      }

      const batch = (body.pipelines || [
        { params: { sources: ["api", "database"], outputFormat: "json" } },
        { params: { sources: ["cache", "stream"], outputFormat: "csv" } },
        { params: { sources: ["api", "cache", "stream"], outputFormat: "parquet" } },
      ]);

      const instances = await env.DATA_PIPELINE.createBatch(batch);

      return Response.json({
        message: `Created ${instances.length} pipeline instances`,
        instances: instances.map((inst) => ({
          id: inst.id,
          checkStatus: `${url.origin}?instanceId=${inst.id}`,
        })),
      });
    }

    // POST / — create a single pipeline instance
    if (request.method === "POST") {
      let params;
      try {
        params = await request.json();
      } catch {
        params = {
          sources: ["api", "database", "cache"],
          outputFormat: "json",
        };
      }

      const instance = await env.DATA_PIPELINE.create({ params });

      return Response.json({
        message: "Data pipeline workflow started",
        instanceId: instance.id,
        checkStatus: `${url.origin}?instanceId=${instance.id}`,
        batchEndpoint: `${url.origin}/batch`,
      });
    }

    // GET / — usage info
    return Response.json({
      name: "workflow-parallel",
      description:
        "Data pipeline with parallel fan-out/fan-in — demonstrates Promise.all, ctx.attempt, createBatch",
      features: {
        "Promise.all + step.do": "True parallel step execution (fan-out)",
        "ctx.attempt": "Retry attempt tracking (1-indexed)",
        "createBatch": "Batch instance creation (POST /batch)",
        "Fan-out / Fan-in":
          "Parallel fetch → parallel transform → aggregate → parallel write",
      },
      endpoints: {
        usage: { method: "GET", path: "/" },
        createSingle: {
          method: "POST",
          path: "/",
          body: {
            sources: ["api", "database", "cache"],
            outputFormat: "json",
          },
        },
        createBatch: {
          method: "POST",
          path: "/batch",
          body: {
            pipelines: [
              { params: { sources: ["api"], outputFormat: "json" } },
              { params: { sources: ["cache"], outputFormat: "csv" } },
            ],
          },
        },
        checkStatus: { method: "GET", path: "/?instanceId=<id>" },
      },
    });
  },
};