"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = __importDefault(require("http"));
const analysisWorker_1 = require("./analysisWorker");
const port = Number(process.env.PORT || "8080");
function startHealthServer() {
    const server = http_1.default.createServer((req, res) => {
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
    await (0, analysisWorker_1.startAnalysisWorkerLoop)();
}
main().catch((e) => {
    console.error("worker-server fatal:", e);
    process.exit(1);
});
