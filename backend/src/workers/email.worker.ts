import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../config/redis.js';
import { prisma } from '../config/db.js';
import { sendMail } from '../services/email.js';
import { esClient } from '../config/elasticsearch.js';
import { sendSlackRateLimitNotification } from '../integrations/slack.js';
import { addEmailToQueue } from '../queues/email.queue.js';


const redisClient = getRedisConnection();

const LUA_RATE_LIMIT = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
  end
  return current
`;

// Helper to format date into hourly key: YYYY-MM-DD-HH
function getHourlyKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}-${hh}`;
}

export function startEmailWorker() {
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

  console.log(`Starting Email Worker with concurrency: ${concurrency}`);

  const worker = new Worker(
    'email-send-queue',
    async (job: Job<{ emailId: string }>) => {
      const { emailId } = job.data;
      console.log(`[Worker] Processing job ${job.id} for Email ID: ${emailId}`);

      // 1. Load email from MySQL
      const email = await prisma.scheduledEmail.findUnique({
        where: { id: emailId },
        include: {
          sender: true,
          campaign: true,
          user: true,
        },
      });

      if (!email) {
        console.warn(`[Worker] Email with ID ${emailId} not found in database. Skipping.`);
        return;
      }

      // 2. Idempotency Check: if already SENT, do nothing
      if (email.status === 'SENT') {
        console.log(`[Worker] Email ${emailId} is already marked as SENT. Skipping.`);
        return;
      }

      // 3. Atomically lock and transition status to PROCESSING
      try {
        await prisma.scheduledEmail.update({
          where: {
            id: emailId,
            status: { in: ['SCHEDULED', 'RATE_LIMITED', 'FAILED'] },
          },
          data: {
            status: 'PROCESSING',
            attempts: { increment: 1 },
          },
        });
      } catch (error) {
        console.log(`[Worker] Email ${emailId} is already being processed or is sent. Skipping duplicate processing.`);
        return;
      }

      // 4. Rate Limiting Check using Redis atomic operation
      const now = new Date();
      const hourKey = getHourlyKey(now);
      const redisRateKey = `email-rate:${email.senderId}:${hourKey}`;

      // Hourly TTL is 3960 seconds (1 hour 6 minutes) to cover the sliding window safely
      const currentRateCount = (await redisClient.eval(
        LUA_RATE_LIMIT,
        1,
        redisRateKey,
        '3960'
      )) as number;

      const hourlyLimit = email.campaign.hourlyLimit;

      if (currentRateCount > hourlyLimit) {
        console.log(`[Worker] Rate limit exceeded for Sender: ${email.sender.email} (${currentRateCount}/${hourlyLimit}). Rescheduling email.`);

        // Calculate delay to next hour
        const nextHour = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours() + 1,
          0,
          0,
          0
        );
        const delayMs = nextHour.getTime() - now.getTime();

        const nextJobId = `${emailId}:resched:${nextHour.getTime()}`;

        // Update email status back to RATE_LIMITED and schedule time
        await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'RATE_LIMITED',
            scheduledAt: nextHour,
          },
        });

        // Reschedule job in BullMQ with unique deterministic jobId
        await addEmailToQueue(emailId, delayMs, nextJobId);

        // Slack notification logic (prevent duplicate alerts in same hour)
        if (email.user.slackAccessToken && email.user.slackChannelId) {
          const slackNotifyKey = `slack-rate-limit-notified:${email.senderId}:${hourKey}`;
          const alreadyNotified = await redisClient.get(slackNotifyKey);

          if (!alreadyNotified) {
            console.log(`[Worker] Posting rate limit warning to Slack for ${email.sender.email}`);

            const nextHourStr = nextHour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const success = await sendSlackRateLimitNotification(
              email.user.slackAccessToken,
              email.user.slackChannelId,
              email.sender.email,
              nextHourStr
            );

            if (success) {
              await redisClient.set(slackNotifyKey, 'true', 'EX', 3600); // cache for 1 hour
            }
          }
        }

        return { status: 'RATE_LIMITED', nextAttempt: nextHour };
      }

      // 5. Send email via Nodemailer Ethereal SMTP
      console.log(`[Worker] Sending email to ${email.recipient} via Ethereal SMTP...`);
      const sendResult = await sendMail({
        to: email.recipient,
        subject: email.subject,
        body: email.body,
        senderName: email.sender.name,
        senderEmail: email.sender.email,
      });

      const sentAtDate = new Date();

      if (sendResult.success) {
        // Update database to SENT
        const updatedEmail = await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt: sentAtDate,
            previewUrl: sendResult.previewUrl || null,
          },
        });

        console.log(`[Worker] Email ${emailId} successfully sent! Preview URL: ${sendResult.previewUrl}`);

        // Index in Elasticsearch
        try {
          await esClient.index({
            index: 'emails',
            id: emailId,
            document: {
              emailId: emailId,
              userId: email.userId,
              sender: email.sender.email,
              recipient: email.recipient,
              subject: email.subject,
              body: email.body,
              status: 'SENT',
              scheduledAt: email.scheduledAt.toISOString(),
              sentAt: sentAtDate.toISOString(),
            },
          });
          console.log(`[Worker] Indexed email ${emailId} in Elasticsearch.`);
        } catch (esError) {
          console.error(`[Worker] Failed to index email ${emailId} in Elasticsearch:`, esError);
        }

        return { status: 'SENT', previewUrl: sendResult.previewUrl };
      } else {
        // Sending failed
        console.error(`[Worker] Email sending failed for ${emailId}: ${sendResult.error}`);

        await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'FAILED',
            errorMessage: sendResult.error || 'Nodemailer SMTP failed',
          },
        });

        // Trigger indexing for FAILED emails too so search logs show it
        try {
          await esClient.index({
            index: 'emails',
            id: emailId,
            document: {
              emailId: emailId,
              userId: email.userId,
              sender: email.sender.email,
              recipient: email.recipient,
              subject: email.subject,
              body: email.body,
              status: 'FAILED',
              scheduledAt: email.scheduledAt.toISOString(),
              sentAt: null,
            },
          });
        } catch (esError) {
          // ignore
        }

        throw new Error(sendResult.error || 'SMTP delivery failed');
      }
    },
    {
      connection: getRedisConnection(),
      concurrency,
    }
  );

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Worker] Worker error:`, err);
  });

  return worker;
}

// Start worker immediately when file is executed
startEmailWorker();

