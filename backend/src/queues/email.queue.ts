import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const emailQueueName = 'email-send-queue';

export const emailQueue = new Queue(emailQueueName, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true, // We store status and history in MySQL/ES
    removeOnFail: false,     // Keep failed jobs for dashboard inspection
  },
});

/**
 * Adds an email job to the BullMQ delayed queue.
 * @param emailId The unique ID of the scheduled email in MySQL
 * @param delayMs The delay in milliseconds from now when the email should be sent
 */
export async function addEmailToQueue(emailId: string, delayMs: number) {
  // Use emailId as the BullMQ jobId to guarantee queue-level idempotency
  return await emailQueue.add(
    'send-email',
    { emailId },
    { 
      delay: delayMs > 0 ? delayMs : 0, 
      jobId: emailId 
    }
  );
}
