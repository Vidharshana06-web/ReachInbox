# ReachInbox Full-Stack Email Job Scheduler

A full-stack email scheduling application demonstrating production-oriented concepts: persistent job queues, delayed scheduling, rate limiting, database and queue idempotency, asynchronous email processing, text search with search-engine fallback, and integrations.

Built as a monorepo containing a React (Vite) frontend, an Express.js (TypeScript) backend, a MySQL database managed with Prisma, Redis (via BullMQ), and Elasticsearch.

---

## Technical Architecture Overview

```mermaid
graph TD
    ReactApp[React Frontend - Port 5173] -->|API Requests| ExpressServer[Express.js Backend - Port 5000]
    ExpressServer -->|Read/Write| MySQL[(MySQL Database - Port 3307)]
    ExpressServer -->|Enqueue Jobs| BullQueue[BullMQ - Redis Port 6379]
    
    subgraph Workers [Worker Process]
        EmailWorker[BullMQ Worker - Concurrency: 5]
    end
    
    BullQueue -->|Process Jobs| EmailWorker
    EmailWorker -->|Atomic Increment & Check| RedisRate[Redis Counter - Rate Limit]
    EmailWorker -->|Update Status & Lock| MySQL
    EmailWorker -->|Send Emails| Ethereal[Ethereal SMTP Mail Server]
    EmailWorker -->|Index Logs| Elasticsearch[Elasticsearch - Port 9200]
    EmailWorker -->|Alert Limit Violations| SlackAPI[Slack Webhook / Chat API]
    
    ExpressServer -->|Search Logs| Elasticsearch
    ExpressServer -->|Expose Queues State| BullBoard[Bull Board Dashboard - /admin/queues]
```

### Flow Definitions:

1. **Email Scheduling Flow:**
   - **Scheduling Phase:** React Frontend → Express REST API → MySQL (Prisma) → Enqueues delayed job in BullMQ (Redis).
   - **Execution Phase:** Redis → Email Worker → Conditional MySQL Transaction (Lock) → Nodemailer Transporter → Ethereal SMTP Server.
   - **Post-Delivery Phase:** Email Worker indexes log details into Elasticsearch and notifications are pushed to Slack in case of rate violations.

2. **Search Logs Flow:**
   - Express REST API queries the Elasticsearch index.
   - If Elasticsearch is offline or down, queries fall back seamlessly to MySQL `LIKE %query%` patterns.

---

## Core Systems & Implementation Details

### 1. Persistent Job Queues (No Cron Jobs)
Schedules are managed via **BullMQ Delayed Jobs** in Redis instead of database polling cron jobs:
- The backend calculates the delay (scheduled start time minus current time) for each recipient.
- An email task is added to BullMQ with a specific `delay` parameter.
- Redis persists these delayed jobs. When the delay expires, BullMQ promotes the task to the active queue for immediate processing by the worker.

### 2. Atomic Hourly Rate Limiting
To prevent race conditions when multiple parallel workers process emails at the same time:
- Uses a **Redis-based atomic counter** using a Lua script:
  ```lua
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  return current
  ```
- If the sending limit is reached, the worker transitions the email status to `RATE_LIMITED`, calculates the delay to the start of the next hour, and schedules a new delayed BullMQ task.
- A Slack alert warning is sent immediately to the user's channel if Slack integration is active.

### 3. Idempotency & DB-Level Locking
- A deterministic `idempotencyKey` is generated for every email: `campaign:{campaignId}:recipient:{recipient.toLowerCase()}`.
- Before transmission, the worker locks the email by transitioning its status from `SCHEDULED`/`RATE_LIMITED`/`FAILED` to `PROCESSING` inside a MySQL conditional query transaction.
- If the status is already `SENT` or `PROCESSING`, the execution is immediately skipped.

### 4. Restart Resilience
Because delayed jobs and task parameters are stored in Redis, stopping the Express server or Worker process does not cause scheduling loss. Once processes reboot, BullMQ automatically polls Redis and resumes execution.

### 5. Testing with Ethereal SMTP
- Ethereal SMTP is a fake SMTP service used for testing. **Emails are not sent to real inboxes.**
- When the worker executes, Ethereal returns a unique message logging URL (`previewUrl`).
- Clicking "Preview" on the frontend fetches email parameters from the backend database and displays details inside a sandboxed iframe. If Ethereal's preview URL exists, it provides a link to view the email log in Ethereal.
- If Ethereal credentials are not configured in the `.env` file, the application auto-generates a mock developer account on startup and prints credentials in the worker console.

---

## Project Structure

```text
reachinbox-email-scheduler/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma    # MySQL Database Schemas
│   ├── src/
│   │   ├── config/          # Client initializers (Prisma DB, Redis, Elasticsearch)
│   │   ├── controllers/     # Express route controllers (Auth, Senders, Emails, Slack, Search)
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
│   │   ├── pages/           # Pages (LoginPage, Dashboard)
│   │   ├── layouts/         # Layout view wrapper (DashboardLayout)
│   │   ├── services/        # Axios API wrappers
│   │   ├── context/         # AuthContext state provider
│   │   ├── types/           # TS interfaces
│   │   ├── App.tsx          # Router configuration
│   │   └── main.tsx         # Render entrypoint
│   ├── package.json
│   └── vite.config.ts
├── scripts/
│   └── create-test-emails.ts # Load testing CLI tool
├── docker-compose.yml       # Docker config (Redis + Elasticsearch)
├── package.json             # Root package script manager
└── README.md
```

---

## Core Infrastructure Setup

### Prerequisites
1. **Node.js**: v18 or v20
2. **Docker Desktop**: For running MySQL, Redis, and Elasticsearch containers

---

### Step 1: Start Docker Services
Start the required background containers by running this command in the project root:
```bash
npm run docker:up
```
This starts:
- **MySQL 8.0**: localhost:3307 (password `reachinbox123`)
- **Redis**: localhost:6379
- **Elasticsearch**: localhost:9200 (security disabled)

To stop the containers:
```bash
npm run docker:down
```

---

### Step 2: Configure Environment Variables
Navigate to the `backend/` directory and copy `.env.example` to `.env`. Set up the environment variables:
```bash
# In the backend directory
copy .env.example .env
```

Set up these key variables (with placeholders for secrets):
```env
PORT=5000
DATABASE_URL="mysql://root:reachinbox123@localhost:3307/reachinbox"
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_URL=http://localhost:9200
JWT_SECRET="your-jwt-secret-key-at-least-32-characters"
SESSION_SECRET="your-session-secret-key"

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
npm.cmd run db:generate

# Deploy schema migrations to the MySQL database
npm.cmd run db:migrate
```

---

## Running the Application

To run the application, launch three separate terminal windows in the project root directory `C:\Users\keyan\Desktop\reachinbox-email-scheduler`:

### Terminal 1: Start Backend Express Server
```bash
npm.cmd run dev:backend
```
Starts Express API on `http://localhost:5000`.

### Terminal 2: Start BullMQ Worker Process
```bash
npm.cmd run dev:worker
```
Starts the email worker process to check Redis, process scheduled jobs, and transmit emails.

### Terminal 3: Start React Frontend Server
```bash
npm.cmd run dev:frontend
```
Launches the frontend server. Open your browser to `http://localhost:5173`.

---

## API Documentation

### Authentication Routes
- **GET `/api/auth/google`**: Redirects to Google Consent Screen.
- **GET `/api/auth/google/callback`**: Handles Google OAuth callback and sets JWT token.
- **GET `/api/auth/me`**: Returns details of the logged-in user and Slack status.
- **POST `/api/auth/logout`**: Clears user session.

### Senders Routes
- **GET `/api/senders`**: Retrieves all configured email senders for the logged-in user.
- **POST `/api/senders`**: Adds a new email sender profile (Parameters: `name`, `email`).
- **DELETE `/api/senders/:id`**: Deletes a sender profile.

### Email Campaigns / Jobs Routes
- **POST `/api/emails/schedule`**: Creates a campaign and schedules delayed jobs.
  - **Body parameters**: `senderId`, `subject`, `body`, `recipients` (array of emails), `startTime` (ISO string), `delayBetweenEmails` (milliseconds), `hourlyLimit`.
- **GET `/api/emails/scheduled`**: Retrieves list of scheduled, rate limited, or processing emails.
- **GET `/api/emails/sent`**: Retrieves list of sent or failed email logs.
- **GET `/api/emails/:id`**: Fetches details of a specific email by ID.
- **POST `/api/emails/:id/cancel`**: Cancels a scheduled email, removing it from BullMQ.

### Search Route
- **GET `/api/search/emails?q=<query>`**: Performs fuzzy text search on recipient, subject, and body using Elasticsearch, falling back to MySQL if Elasticsearch is down.

### Slack Integration Routes
- **GET `/api/slack/connect`**: Initiates Slack OAuth. (Query parameters: `token` for auth validation).
- **GET `/api/slack/callback`**: Callback exchanging code for integration bot access.
- **GET `/api/slack/status`**: Returns Slack connection status.
- **POST `/api/slack/disconnect`**: Disconnects and removes Slack integration tokens.

### Health Route
- **GET `/api/health`**: Simple server health status checks.

---

## CSV/TXT Recipient List Formatting

When creating a campaign, upload a `.csv` or `.txt` file containing your recipient emails.

- **Header format (CSV):**
  ```text
  email
  john@example.com
  alice@example.com
  ```
- **Raw format (CSV/TXT):**
  ```text
  john@example.com
  alice@example.com
  ```

*Note: Trimming and case-insensitive deduplication occur automatically on the backend per campaign.*

---

## Assignment Requirements Checklist

| Requirement | Implementation | Status |
|---|---|:---:|
| Accept email send requests via APIs | Express REST API endpoints | ✅ |
| Schedule emails at a specific time | BullMQ delayed jobs | ✅ |
| No cron jobs | BullMQ + Redis integration | ✅ |
| Fake SMTP | Ethereal SMTP | ✅ |
| Persistent jobs | Redis/BullMQ persistence | ✅ |
| Restart resilience | Persistent BullMQ/Redis state | ✅ |
| Frontend dashboard | React/Vite | ✅ |
| View scheduled emails | Scheduled Queue tab in Dashboard | ✅ |
| View sent emails | Completed Delivery tab in Dashboard | ✅ |
| Queue monitoring dashboard | Bull Board at `/admin/queues` | ✅ |
| Search functionality | Elasticsearch index with MySQL fallback | ✅ |

---

## Security & Production Considerations

### Implemented Security Measures
- **JWT Authentication**: Secured endpoints verify JWT signature.
- **Protected Routes**: Middleware verifies authentication before letting users interact with senders or campaigns.
- **CORS Configuration**: Restricts access to allowed frontend origins.
- **Environment Variables**: Protects database strings, JWT secrets, and OAuth client keys.

### Production Considerations (Next Steps)
- **Production SMTP**: Swap Ethereal SMTP with a production service (SendGrid, Mailgun, Amazon SES).
- **Distributed Workers**: Deploy workers in standalone server scaling groups.
- **Advanced Analytics**: Add click/open tracking pixels and logs.
- **Improved Retry/Backoff**: Fine-tune backoff timers and route failed messages to a Dead Letter Queue (DLQ).
- **Infrastructure Hardening**: Add SSL/HTTPS, rate-limiting middleware (like `express-rate-limit`), and encrypt OAuth access tokens in the database.
