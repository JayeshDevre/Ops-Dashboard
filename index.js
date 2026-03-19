const express = require("express");
const responseTime = require("response-time");
const client = require("prom-client");
const {createLogger, transports} = require("winston");
const LokiTransport = require("winston-loki");

const options = {
  transports:[
    new LokiTransport({
      host: process.env.LOKI_HOST || "http://localhost:3100"
    })
  ]
};
const logger = createLogger(options);
const { doSomeHeavyTask } = require("./util");

const app = express();
const PORT = process.env.PORT || 8000;

// Default Node.js metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register: client.register });

// Custom HTTP metrics
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

// Example custom metrics
const heavyTasksCompleted = new client.Counter({
  name: "heavy_tasks_completed_total",
  help: "Total heavy tasks completed",
  labelNames: ["status"],
});

const heavyTasksFailed = new client.Counter({
  name: "heavy_tasks_failed_total",
  help: "Total heavy tasks that failed",
  labelNames: ["error_type"],
});

const heavyTaskDuration = new client.Histogram({
  name: "heavy_task_duration_seconds",
  help: "Duration of heavy tasks in seconds",
  buckets: [0.1, 0.25, 0.5, 1, 2, 3, 5],
});

const activeRequests = new client.Gauge({
  name: "active_requests",
  help: "Number of requests in progress",
});

// Middleware MUST be before routes to measure all requests
app.use(responseTime((req, res, time) => {
  const route = req.route?.path || req.path || req.url;
  const statusCode = res.statusCode.toString();
  const durationSec = time / 1000; // response-time gives ms

  httpRequestDuration.labels(req.method, route, statusCode).observe(durationSec);
  httpRequestsTotal.labels(req.method, route, statusCode).inc();
}));

// Routes
app.get("/", (req, res) => {
  logger.info("Hello from Express!");
  res.json({ message: "Hello from Express!", status: "ok" });
});

app.get("/slow", async (req, res) => {
  logger.info("Slow request received");
  activeRequests.inc();
  const start = Date.now();

  try {
    const timeTaken = await doSomeHeavyTask();
    heavyTaskDuration.observe((Date.now() - start) / 1000);
    heavyTasksCompleted.labels("success").inc();

    activeRequests.dec();
    return res.json({
      status: "success",
      message: `Heavy task completed in ${timeTaken}ms`,
    });
  } catch (error) {
    logger.error("Error in slow request", error);
   
    heavyTasksFailed.labels(error.message).inc();
    heavyTasksCompleted.labels("error").inc();
    activeRequests.dec();

    return res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

app.get("/metrics", async (req, res) => {
  logger.info("Metrics request received");
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.listen(PORT, () =>
  console.log(`Express Server Started at http://localhost:${PORT}`)
);