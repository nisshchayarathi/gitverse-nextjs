import "dotenv/config";
import http from "http";

import { startAnalysisWorkerLoop } from "./analysisWorker";

const port = Number(process.env.PORT || "8080");

function startHealthServer() {
  const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/healthz" || req.url === "/readyz") {
      res.statusCode = 200;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end("ok");
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

async function main() {
  startHealthServer();

  // Run worker loop indefinitely.
  await startAnalysisWorkerLoop();
}

main().catch((e) => {
  console.error("worker-server fatal:", e);
  process.exit(1);
});
