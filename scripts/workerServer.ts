import "dotenv/config";
import http from "http";

import { startAnalysisWorkerLoop } from "./analysisWorker";

const port = Number(process.env.PORT || "8080");

function startHealthServer() {
  const server = http.createServer((req, res) => {
    // health endpoints
    if (req.url === "/" || req.url === "/healthz" || req.url === "/readyz") {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
      return;
    }

    // Control endpoint: start a worker run with validated input
    if (req.method === "POST" && req.url === "/run") {
      (async () => {
        try {
          const ct = String(req.headers["content-type"] || "").toLowerCase();
          if (!ct.startsWith("application/json")) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Content-Type must be application/json" }));
            return;
          }

          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 1_000_000) break; // guard
          }

          let parsed: any;
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch (e) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "Invalid JSON body" }));
            return;
          }

          const { ok, errors, opts } = validateRunOptions(parsed);
          if (!ok) {
            res.statusCode = 400;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: errors.join("; ") }));
            return;
          }

          // Start the worker loop in background. Do not expose internal errors to clients.
          void startAnalysisWorkerLoop(opts).catch((e) =>
            console.error("/run: failed to start worker loop", e)
          );

          res.statusCode = 202;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ status: "started" }));
          return;
        } catch (e: any) {
          // Unexpected server error: return generic message without stack
          console.error("/run: unexpected error", e);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "internal server error" }));
          return;
        }
      })();
      return;
    }

    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("not found");
  });

  server.listen(port, () => {
    console.log(`worker health server listening on :${port}`);
  });
}

function validateRunOptions(input: any): {
  ok: boolean;
  errors: string[];
  opts?: {
    workerId?: string;
    pollIntervalMs?: number;
    heartbeatIntervalMs?: number;
    lockMs?: number;
    once?: boolean;
  };
} {
  const errors: string[] = [];
  const opts: any = {};

  if (input == null || typeof input !== "object") {
    errors.push("body must be a JSON object");
    return { ok: false, errors };
  }

  if ("workerId" in input) {
    if (typeof input.workerId !== "string" || input.workerId.trim() === "") {
      errors.push("workerId must be a non-empty string");
    } else {
      opts.workerId = input.workerId.trim();
    }
  }

  if ("once" in input) {
    if (typeof input.once !== "boolean") errors.push("once must be a boolean");
    else opts.once = input.once;
  }

  const intFields: Array<"pollIntervalMs" | "heartbeatIntervalMs" | "lockMs"> = [
    "pollIntervalMs",
    "heartbeatIntervalMs",
    "lockMs",
  ];

  for (const f of intFields) {
    if (f in input) {
      const n = Number(input[f]);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
        errors.push(`${f} must be a positive integer`);
      } else {
        opts[f] = n;
      }
    }
  }

  return { ok: errors.length === 0, errors, opts };
}

async function main() {
  startHealthServer();

  // Run worker loop indefinitely.
  await startAnalysisWorkerLoop();
}

main().catch((e) => {
  console.error("worker-server fatal:", e);
  process.exit(1);
});                        