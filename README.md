# Ops Dashboard (Prometheus + Grafana + Loki)

This project is a **Node.js (Express) app** instrumented with:

- **Prometheus**: metrics scraping from `GET /metrics`
- **Grafana**: dashboards for metrics + logs
- **Loki**: centralized logs (Winston → Loki)

---

## What you built

- A Node.js service exposing **app + runtime metrics** via Prometheus.
- A **load/error generator** endpoint (`/slow`) to test dashboards.
- A Grafana environment to visualize:
  - **Metrics** (Prometheus)
  - **Logs** (Loki)

### Example Dashboard

![Grafana Dashboard](docs/screenshots/02-grafana-example-dashboard.png)

---

## Prerequisites

- Node.js + npm
- Docker (optional, for Prometheus/Grafana/Loki)

---

## Project overview

- **App**: `index.js`
- **Metrics endpoint**: `GET /metrics` (Prometheus scrapes this)
- **Test routes**:
  - `GET /` (quick response)
  - `GET /slow` (random delay, sometimes throws an error)
- **Prometheus config**: `prometheus-config.yml`
- **Docker compose**: `docker-compose.yml` (Prometheus)

---

## 1) Install dependencies

```bash
npm install
```

---

## 2) Start the Node app

```bash
npm start
```

App runs on `http://localhost:8000`.

---

## 3) Start Prometheus (Docker Compose)

```bash
docker-compose up -d
```

Prometheus runs on `http://localhost:9090`.

### Prometheus scrape target

Update `prometheus-config.yml` to match where your Node app is reachable from Prometheus.
Examples:

- `localhost:8000` (Prometheus running on the same host network as the app)
- `host.docker.internal:8000` (Prometheus running in Docker and the app on the host)
- `<YOUR_NODE_HOST>:8000` (replace with your node host/IP)

Check scrape status in Prometheus:

- `http://localhost:9090/targets`

---

## 4) Start Loki

If you already run Loki elsewhere, use that.

### Option A: Run Loki with Docker

```bash
docker run -d --name loki -p 3100:3100 grafana/loki:2.9.2 -config.file=/etc/loki/local-config.yaml
```

Loki readiness check:

```bash
curl http://localhost:3100/ready
```

---

## 5) Start Grafana

```bash
docker run -d -p 3000:3000 --name grafana grafana/grafana-oss
```

Grafana runs on `http://localhost:3000` (default login: `admin` / `admin`).

---

## 6) Configure Grafana data sources

### Prometheus

- If Grafana can reach Prometheus via localhost: `http://localhost:9090`
- If Grafana runs in Docker and Prometheus is on the host: `http://host.docker.internal:9090`

### Loki

- If Grafana can reach Loki via localhost: `http://localhost:3100`
- If Grafana runs in Docker and Loki is on the host: `http://host.docker.internal:3100`

---

## 7) Verify metrics

Open:

- `http://localhost:8000/metrics`

Example PromQL queries in Prometheus/Grafana:

```promql
up
nodejs_version_info
process_resident_memory_bytes
irate(process_cpu_user_seconds_total[2m]) * 100
```

Custom app metrics (examples):

```promql
http_requests_total
http_request_duration_seconds_bucket
heavy_tasks_completed_total
heavy_tasks_failed_total
heavy_task_duration_seconds_bucket
active_requests
```

Generate traffic:

```bash
curl http://localhost:8000/
curl http://localhost:8000/slow
```

---

## 8) Verify logs in Loki

### Important

Loki log queries return **log lines (strings)**. In Grafana, use **Logs** visualization (or Table).
If you choose **Time series**, you must use a metric query like `count_over_time(...)`.

### LogQL examples

Show all logs:

```logql
{}
```

Show error logs:

```logql
{level="error"}
```

Count logs (time series):

```logql
count_over_time({level="info"}[5m])
```

---

## Common troubleshooting

- **Grafana shows “No data” for Loki logs**:
  - Make sure you’re using **Logs** visualization
  - Increase time range to **Last 1 hour**
  - Verify Loki is ready: `curl http://localhost:3100/ready`
- **Prometheus target is DOWN**:
  - Verify app is running on port 8000
  - Verify `prometheus-config.yml` target host is reachable from Prometheus container/host

