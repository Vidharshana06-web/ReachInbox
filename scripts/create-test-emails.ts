import { PrismaClient } from '@prisma/client';
import { addEmailToQueue } from '../backend/src/queues/email.queue.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const prisma = new PrismaClient();

async function run() {
  const count = parseInt(process.argv[2] || '100', 10);
  console.log(`[Load Test] Preparing to schedule ${count} load test emails...`);

  try {
    // 1. Ensure we have a user
    let user = await prisma.user.findFirst();
    if (!user) {
      console.log('[Load Test] Creating a dummy user...');
      user = await prisma.user.create({
        data: {
          googleId: 'dummy-load-test-id',
          name: 'Load Test Tester',
          email: 'loadtest@example.com',
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
        },
      });
    }

    // 2. Ensure we have a sender
    let sender = await prisma.emailSender.findFirst({
      where: { userId: user.id },
    });
    if (!sender) {
      console.log('[Load Test] Creating a dummy sender...');
      sender = await prisma.emailSender.create({
        data: {
          userId: user.id,
          name: 'Test Account',
          email: 'test-sender@example.com',
        },
      });
    }

    // 3. Create a test campaign
    console.log('[Load Test] Creating Campaign record...');
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId: user.id,
        senderId: sender.id,
        subject: `Load Test Alert - ${new Date().toLocaleTimeString()}`,
        body: '<h3>Hello!</h3><p>This is an automated load-testing email payload to verify rate limits and queue concurrency.</p>',
        startTime: new Date(),
        delayBetweenEmails: 1000, // 1 second delay
        hourlyLimit: 25,          // Low limit to guarantee rate limit kicks in immediately
        status: 'SCHEDULED',
      },
    });

    console.log(`[Load Test] Campaign created ID: ${campaign.id}`);
    console.log(`[Load Test] Scheduling ${count} ScheduledEmail entries...`);

    const startTimestamp = Date.now() + 5000; // start in 5 seconds
    const delayMs = 1000;

    for (let i = 0; i < count; i++) {
      const recipient = `loadtest-recipient-${i + 1}@example.com`;
      const idempotencyKey = `campaign:${campaign.id}:recipient:${recipient}`;
      const scheduledTime = new Date(startTimestamp + i * delayMs);
      const delayFromNow = scheduledTime.getTime() - Date.now();

      const scheduledEmail = await prisma.scheduledEmail.create({
        data: {
          campaignId: campaign.id,
          userId: user.id,
          senderId: sender.id,
          recipient,
          subject: campaign.subject,
          body: campaign.body,
          scheduledAt: scheduledTime,
          status: 'SCHEDULED',
          idempotencyKey,
        },
      });

      // Add to BullMQ
      const job = await addEmailToQueue(scheduledEmail.id, delayFromNow);

      // Save job ID
      await prisma.scheduledEmail.update({
        where: { id: scheduledEmail.id },
        data: { bullJobId: job.id },
      });

      if ((i + 1) % 50 === 0 || i + 1 === count) {
        console.log(`[Load Test] ... scheduled ${i + 1}/${count} emails`);
      }
    }

    console.log('====================================================');
    console.log(`[Load Test] SUCCESS: ${count} test jobs generated!`);
    console.log(`[Load Test] Senders limit: 25 emails / hour`);
    console.log(`[Load Test] Start the worker command: npm run worker`);
    console.log(`[Load Test] Open the Bull Board to watch execution:`);
    console.log(`            http://localhost:5000/admin/queues`);
    console.log('====================================================');
  } catch (error) {
    console.error('[Load Test] Error during execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

run();
