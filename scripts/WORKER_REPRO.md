Manual repro for worker POST /run endpoint

This file documents how to exercise the new validation and expected responses.

Prerequisite: the server is running (it starts when you run the script normally):

Windows PowerShell / cmd example:

```bash
node dist/workerServer.js
# or when running ts-node in dev
npx ts-node scripts/workerServer.ts
```

1. Valid request (starts background worker loop)

```bash
curl -X POST http://localhost:8080/run \
  -H "Content-Type: application/json" \
  -d '{"once": true, "workerId": "test-worker-1", "pollIntervalMs": 2000}'

# Expected response: 202 with JSON {"status":"started"}
```

2. Invalid JSON

```bash
curl -X POST http://localhost:8080/run \
  -H "Content-Type: application/json" \
  -d '{invalid json'

# Expected response: 400 with JSON {"error":"Invalid JSON body"}
```

3. Invalid input types (validation error)

```bash
curl -X POST http://localhost:8080/run \
  -H "Content-Type: application/json" \
  -d '{"once": "no", "pollIntervalMs": -5}'

# Expected response: 400 with JSON {"error": "once must be a boolean; pollIntervalMs must be a positive integer"}
```

Notes

- Error responses never include stack traces; they return concise JSON `error` messages.
- The endpoint expects `application/json` Content-Type.
- Use the `once` flag to run one pass (`true`) or omit to run the regular long-lived loop.
