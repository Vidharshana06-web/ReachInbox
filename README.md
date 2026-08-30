# ReachInbox Full-Stack Email Job Scheduler

A production-grade full-stack email scheduling and automation application demonstrating high-throughput architectural concepts: persistent job queues, delayed scheduling, atomic rate limiting, database and queue idempotency, asynchronous email processing, search-engine text query logs, custom queue visualizers, and Slack notification integrations.

Built as a monorepo containing a React (Vite + Tailwind CSS) frontend, an Express.js (TypeScript) backend, a MySQL database managed with Prisma, Redis (via BullMQ), and Elasticsearch.

---


Live Project: https://reachinbox-1-szr9.onrender.com/dashboard

Demo Video:  https://drive.google.com/file/d/1DSSzkUFvCZQQhBqMZzt1vL-2lFjaL9Oe/view?usp=sharing

## Technical Architecture Overview

The system architecture utilizes a distributed, asynchronous queue worker model to isolate the main API server from high-latency SMTP delivery operations.

```mermaid
graph TD
    ReactApp["React Frontend (Port 5173)"] -->|REST API Requests| ExpressServer["Express.js Backend (Port 5000)"]
    ExpressServer -->|Read / Write| MySQL[("MySQL Database (Port 3307)")]
    ExpressServer -->|Manage Queue| BullQueue["BullMQ (Redis Port 6379)"]
    
    subgraph Workers ["Worker Process"]
        EmailWorker["BullMQ Worker (Concurrency: 5)"]
    end
    
    BullQueue -->|Process Jobs| EmailWorker
    EmailWorker -->|Atomic Check| RedisRate["Redis Counter (Rate Limit)"]
    EmailWorker -->|Lock & Update| MySQL
    EmailWorker -->|Send Emails| Ethereal["Ethereal SMTP Server"]
    EmailWorker -->|Index Logs| Elasticsearch["Elasticsearch (Port 9200)"]
    EmailWorker -->|Alert Limits| SlackAPI["Slack Bot Webhook"]
    
    ExpressServer -->|Search Logs| Elasticsearch
    ExpressServer -->|Query Live Stats| BullQueue
```

### Key Execution Flows

1. **Email Scheduling Flow:**
   - **Scheduling**: React Frontend $\rightarrow$ Express REST API $\rightarrow$ MySQL (Prisma) $\rightarrow$ Enqueues delayed job in BullMQ (Redis).
   - **Execution**: Redis $\rightarrow$ Email Worker $\rightarrow$ Conditional MySQL Transaction (Lock) $\rightarrow$ Nodemailer Transporter $\rightarrow$ Ethereal SMTP Server.
   - **Post-Delivery**: Email Worker indexes log details into Elasticsearch and updates MySQL. If sending limits are violated, notification alerts are pushed to the user's configured Slack channel.

2. **Search Logs Flow:**
   - Express REST API queries the Elasticsearch index.
   - If Elasticsearch is offline or down, queries fall back seamlessly to MySQL `LIKE %query%` patterns.

3. **Queue Monitoring Flow:**
   - React Frontend queries `GET /api/queues` internally.
   - Express queries BullMQ metrics and joins the jobs list with MySQL details (Recipient, Subject, Campaign) so the custom Queue Board renders human-readable information instead of raw IDs.

---

## Core System Architectures & Implementation Details

### 1. Persistent Job Queues (No Cron Jobs)
Schedules are managed via **BullMQ Delayed Jobs** in Redis instead of database polling cron jobs. 
* The backend calculates the delay (scheduled start time minus current time) for each recipient.
* An email task is added to BullMQ with a specific `delay` parameter.
* Redis persists these delayed jobs. When the delay expires, BullMQ promotes the task to the active queue for immediate processing by the worker.

### 2. Atomic Hourly Rate Limiting & Rescheduling Fix
To prevent race conditions when multiple parallel worker threads process emails at the same time:
* Uses a **Redis-based atomic counter** using a Lua script:
  ```lua
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  return current
  ```
* **Rescheduling Collision Bypass**: When the hourly limit is exceeded, the worker transitions the email status to `RATE_LIMITED` and schedules a new delayed BullMQ task for the start of the next hourly window. Since the old job remains active during worker execution, we generate a deterministic rescheduled job ID (`${emailId}:resched:${nextHourTimestamp}`) to bypass BullMQ's active job collision rule, guaranteeing it retries smoothly without getting stuck.

### 3. Idempotency & DB-Level Locking
* A deterministic `idempotencyKey` is generated for every email: `campaign:{campaignId}:recipient:{recipient.toLowerCase()}`.
* Before transmission, the worker locks the email by transitioning its status from `SCHEDULED`/`RATE_LIMITED`/`FAILED` to `PROCESSING` inside a MySQL conditional query transaction.
* If the status is already `SENT` or `PROCESSING`, the execution is immediately skipped.

---

## Project Structure

```text
reachinbox-email-scheduler/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma    # MySQL Database Schemas
│   ├── src/
│   │   ├── config/          # Client initializers (Prisma DB, Redis, Elasticsearch)
│   │   ├── controllers/     # Express controllers (Auth, Senders, Emails, Slack, Search)
│   │   ├── middleware/      # JWT Authentication validation guards
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Ethereal SMTP mail transporter
│   │   ├── queues/          # BullMQ queue instantiator
│   │   ├── workers/         # BullMQ queue worker
│   │   ├── integrations/    # OAuth exchange API clients (Google, Slack)
│   │   ├── app.ts           # App setup, CORS configurations, Bull Board mount
│   │   └── server.ts        # Server entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # UI components (SendersManager, ComposeEmailModal, EmailPreviewModal)
│   │   ├── pages/           # Pages (LoginPage, Dashboard, Jobs, QueueBoard)
│   │   ├── layouts/         # Layout view wrapper (DashboardLayout)
│   │   ├── services/        # Axios API wrappers
│   │   ├── context/         # AuthContext state provider
│   │   ├── types/           # TS interfaces
│   │   ├── App.tsx          # Router configuration
│   │   └── main.tsx         # Render entrypoint
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml       # Docker configurations (Redis + Elasticsearch)
├── package.json             # Root package script manager
└── README.md
```

---

## Core Infrastructure Setup

### Prerequisites
1. **Node.js**: v18 or v20
2. **Docker Desktop**: For running Redis and Elasticsearch containers

---

### Step 1: Start Docker Services
Start the required background containers by running this command in the project root:
```bash
npm run docker:up
```
This starts:
- **Redis**: localhost:6379 (Queue storage)
- **Elasticsearch**: localhost:9200 (Log searching engine)

---

### Step 2: Configure Environment Variables
Navigate to the `backend/` directory and copy `.env.example` to `.env`. Set up the environment variables:
```bash
# In the backend directory
copy .env.example .env
```

Ensure these key variables are configured:
```env
PORT=5000
DATABASE_URL="mysql://root:reachinbox123@localhost:3307/reachinbox"
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_URL=http://localhost:9200

# Google OAuth (Auth & Login)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:5000/api/auth/google/callback"

# Slack OAuth (Alerts Integration)
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_REDIRECT_URI="http://localhost:5000/api/slack/callback"
```

---

### Step 3: Run Database Migrations
Run these commands from the project root directory:
```bash
# Install dependencies for both frontend and backend
npm run install:all

# Generate Prisma Client
npm run db:generate

# Deploy schema migrations to the MySQL database (Port 3307)
npm run db:migrate
```

---

## Running the Application

To run the application, launch three separate terminal windows in the project root directory:

### Terminal 1: Start Backend Express Server
```bash
npm run dev:backend
```
Starts Express API on `http://localhost:5000`.

### Terminal 2: Start BullMQ Worker Process
```bash
npm run dev:worker
```
Starts the email worker process to process scheduled jobs.

### Terminal 3: Start React Frontend Server
```bash
npm run dev:frontend
```
Launches the frontend server. Open your browser to `http://localhost:5173`.

---

## API Documentation

### Authentication Routes
- **GET `/api/auth/google`**: Redirects to Google Consent Screen.
- **GET `/api/auth/google/callback`**: Handles Google OAuth callback.
- **GET `/api/auth/me`**: Returns details of the logged-in user and Slack status.
- **POST `/api/auth/logout`**: Clears user session.

### Senders Routes
- **GET `/api/senders`**: Retrieves all configured email senders for the logged-in user.
- **POST `/api/senders`**: Adds a new email sender profile (Parameters: `name`, `email`).
- **DELETE `/api/senders/:id`**: Deletes a sender profile.

### Email Campaigns / Jobs Routes
- **POST `/api/emails/schedule`**: Creates a campaign and schedules delayed jobs.
- **GET `/api/emails/scheduled`**: Retrieves list of scheduled, rate limited, or processing emails.
- **GET `/api/emails/sent`**: Retrieves list of sent or failed email logs.
- **GET `/api/emails/:id`**: Fetches details of a specific email by ID.
- **POST `/api/emails/:id/cancel`**: Cancels a scheduled email, removing it from BullMQ.
- **GET `/api/campaigns`**: Retrieves a list of all email campaigns.
- **GET `/api/campaigns/:id`**: Fetches campaign details by ID.
- **DELETE `/api/campaigns/:id`**: Deletes campaign, cascades email logs deletion, and cancels active queue jobs.

### Queue Management Routes
- **GET `/api/queues`**: Returns job counts and maps details for 50 recent jobs.
- **POST `/api/queues/retry/:id`**: Retries a failed queue job.
- **POST `/api/queues/remove/:id`**: Cancels/removes a delayed or waiting queue job.
- **POST `/api/queues/clean`**: Cleans completed or failed job logs.

### Search Route
- **GET `/api/search/emails?q=<query>`**: Performs fuzzy text search on recipient, subject, and body using Elasticsearch, falling back to MySQL if Elasticsearch is down.

### Slack Integration Routes
- **GET `/api/slack/connect`**: Initiates Slack OAuth.
- **GET `/api/slack/callback`**: Callback exchanging code for integration bot access.
- **GET `/api/slack/status`**: Returns Slack connection status.
- **POST `/api/slack/disconnect`**: Disconnects and removes Slack integration tokens.

---

## Premium Extra Features Implemented

1. **Integrated Custom Queue Monitor Board**:
   * Completely replaced raw external Bull Board dashboards with a custom React page inside the viewport (`/queues`).
   * Visualizes real-time metrics (Active, Waiting, Delayed, Failed, Completed), joins MySQL info (Subject, Recipient, Campaign) for human-readable logs, and exposes interactive actions (Retry Failed / Remove Job / Clean Logs).
   * Documented auto-clear behavior under the Completed card (jobs are removed from Redis on completion to optimize memory).

2. **Collapsible Sidebar Drawer Navigation**:
   * Added a responsive vertical sidebar navigation panel.
   * Features a hamburger toggle in the top header. It collapses to full-width by default and slides out smoothly on click (static flex-shift on desktop, backdrop overlay drawer on mobile).

3. **Dynamic Campaign Status Resolution**:
   * Rather than remaining statically marked as `SCHEDULED`, campaigns automatically resolve status dynamically on list and retrieval queries based on real-time child job states:
     * `COMPLETED`: All emails sent.
     * `IN_PROGRESS`: Delivery in progress (some sent/failed or rate-limited).
     * `CANCELLED`: All emails cancelled.
     * `SCHEDULED`: All emails pending.

4. **Vibrant Professional Color Coding**:
   * Refined card layouts, buttons, and badges with custom theme palettes: Blue buttons, green completed labels, indigo delayed retries, red failures, and amber pending schedules.

5. **Google & Slack Auth Integration**:
   * Fully configured secure OAuth pipelines for user account login and Slack alerting integration.

---

## Outputs
A visual walkthrough of all major pages and features in ReachInbox Email Scheduler.

### Login Page
A clean, colorful login page displaying the custom `Zap` logo mark, text gradient titles, and a **Continue with Google** OAuth button.
![Login Page](./images/login_page.png)

### Dashboard — Workspace
The main workspace containing quick metrics (Total Campaigns, Total Sent, Active Senders, Success Rate), sender configuration manager (Add Sender), and the **Compose Campaign** button.
![Dashboard Workspace](./images/dashboard_workspace.png)

### Jobs — Campaign Explorer (Split Screen)
The split-screen explorer displaying the list of active user campaigns in a sub-sidebar on the left, and detail cards (campaign metadata, recipient tables, delay metrics, cancel buttons) on the right.
![Jobs Explorer](./images/jobs_explorer.png)

### Queue Monitor Board
The real-time background queue dashboard displaying job counts (Active, Waiting, Delayed, Failed, Completed), cleaning actions, and a detailed jobs table syncing BullMQ details with custom MySQL recipient data.
![Queue Monitor Board](./images/queue_monitor.png)
