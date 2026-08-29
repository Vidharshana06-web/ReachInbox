import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/db.js';
import { addEmailToQueue, emailQueue } from '../queues/email.queue.js';

export async function scheduleCampaign(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const {
    senderId,
    subject,
    body,
    recipients,
    startTime,
    delayBetweenEmails,
    hourlyLimit,
  } = req.body;

  // Validate inputs
  if (!senderId || !subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Sender, subject, body, and list of recipients are required.' });
  }

  const parsedStartTime = new Date(startTime);
  if (isNaN(parsedStartTime.getTime())) {
    return res.status(400).json({ error: 'Invalid start time format.' });
  }

  const delayMs = parseInt(delayBetweenEmails || process.env.DEFAULT_EMAIL_DELAY_MS || '2000', 10);
  const limitPerHour = parseInt(hourlyLimit || process.env.DEFAULT_MAX_EMAILS_PER_HOUR || '200', 10);

  try {
    // Verify email sender ownership
    const sender = await prisma.emailSender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      return res.status(400).json({ error: 'Invalid or unauthorized email sender selected.' });
    }

    // Create the Campaign record in MySQL
    const campaign = await prisma.emailCampaign.create({
      data: {
        userId,
        senderId,
        subject,
        body,
        startTime: parsedStartTime,
        delayBetweenEmails: delayMs,
        hourlyLimit: limitPerHour,
        status: 'SCHEDULED',
      },
    });

    const startTimestamp = parsedStartTime.getTime();
    const createdEmails = [];

    // Deduplicate recipients case-insensitively and trim spaces
    const seen = new Set<string>();
    const uniqueRecipients: string[] = [];
    for (const r of recipients) {
      if (typeof r !== 'string') continue;
      const trimmed = r.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueRecipients.push(trimmed);
      }
    }

    // Create scheduled emails and queue BullMQ tasks
    for (let i = 0; i < uniqueRecipients.length; i++) {
      const recipient = uniqueRecipients[i];

      // Unique deterministic idempotency key per recipient in this campaign
      const idempotencyKey = `campaign:${campaign.id}:recipient:${recipient.toLowerCase()}`;

      // Calculate scheduled time spacing emails based on user delay
      const scheduledTime = new Date(startTimestamp + i * delayMs);
      const delayFromNow = scheduledTime.getTime() - Date.now();

      // Create record in DB first
      const scheduledEmail = await prisma.scheduledEmail.create({
        data: {
          campaignId: campaign.id,
          userId,
          senderId,
          recipient,
          subject,
          body,
          scheduledAt: scheduledTime,
          status: 'SCHEDULED',
          idempotencyKey,
        },
      });

      // Schedule in BullMQ
      const job = await addEmailToQueue(scheduledEmail.id, delayFromNow);

      // Save job details back to DB
      const updatedEmail = await prisma.scheduledEmail.update({
        where: { id: scheduledEmail.id },
        data: { bullJobId: job.id },
      });

      createdEmails.push(updatedEmail);
    }

    return res.status(201).json({
      success: true,
      campaignId: campaign.id,
      totalScheduled: createdEmails.length,
      duplicatesRemoved: recipients.length - uniqueRecipients.length,
    });
  } catch (error: any) {
    console.error('Error creating scheduled campaign:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate scheduling detected for one or more recipients.' });
    }
    return res.status(500).json({ error: 'Failed to schedule email campaign.' });
  }
}

export async function getScheduledEmails(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const emails = await prisma.scheduledEmail.findMany({
      where: {
        userId,
        status: { in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'] },
      },
      include: { sender: true },
      orderBy: { scheduledAt: 'asc' },
    });
    return res.json({ emails });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
}

export async function getSentEmails(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const emails = await prisma.scheduledEmail.findMany({
      where: {
        userId,
        status: { in: ['SENT', 'FAILED'] },
      },
      include: { sender: true },
      orderBy: { updatedAt: 'desc' },
    });
    return res.json({ emails });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
}

export async function getEmailById(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const email = await prisma.scheduledEmail.findFirst({
      where: { id, userId },
      include: { sender: true },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    return res.json({ email });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch email' });
  }
}

export async function cancelEmail(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const email = await prisma.scheduledEmail.findFirst({
      where: { id, userId },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email job not found or unauthorized' });
    }

    if (email.status === 'SENT' || email.status === 'PROCESSING') {
      return res.status(400).json({ error: 'Cannot cancel emails that are already sent or currently being processed.' });
    }

    // Try to remove from BullMQ
    try {
      let job = await emailQueue.getJob(email.id);
      if (!job) {
        const reschedJobId = `${email.id}:resched:${new Date(email.scheduledAt).getTime()}`;
        job = await emailQueue.getJob(reschedJobId);
      }
      if (job) {
        await job.remove();
      }
    } catch (queueErr) {
      console.warn(`Could not remove job ${email.id} from queue:`, queueErr);
    }

    // Update status in DB
    await prisma.scheduledEmail.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return res.json({ success: true, message: 'Scheduled email was successfully cancelled.' });
  } catch (error: any) {
    console.error('Error cancelling email:', error);
    return res.status(500).json({ error: 'Failed to cancel email schedule.' });
  }
}

export async function getCampaignById(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, userId },
      include: {
        sender: true,
        scheduledEmails: {
          include: { sender: true },
          orderBy: { scheduledAt: 'asc' },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const resolvedStatus = resolveCampaignStatusInternal(campaign.status, campaign.scheduledEmails);
    const campaignWithResolvedStatus = {
      ...campaign,
      status: resolvedStatus,
    };

    return res.json({ campaign: campaignWithResolvedStatus });
  } catch (error: any) {
    console.error('Error fetching campaign details:', error);
    return res.status(500).json({ error: 'Failed to fetch campaign details' });
  }
}

export async function getCampaigns(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { userId },
      include: { 
        sender: true,
        scheduledEmails: {
          select: { status: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    const campaignsWithResolvedStatus = campaigns.map(c => {
      const resolvedStatus = resolveCampaignStatusInternal(c.status, c.scheduledEmails);
      return {
        ...c,
        status: resolvedStatus,
      };
    });

    return res.json({ campaigns: campaignsWithResolvedStatus });
  } catch (error: any) {
    console.error('Error fetching campaigns list:', error);
    return res.status(500).json({ error: 'Failed to fetch campaigns.' });
  }
}

export async function deleteCampaign(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id, userId },
      include: { scheduledEmails: true },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found or unauthorized' });
    }

    // Cancel all scheduled BullMQ jobs
    for (const email of campaign.scheduledEmails) {
      if (email.status === 'SCHEDULED' || email.status === 'RATE_LIMITED') {
        try {
          let job = await emailQueue.getJob(email.id);
          if (!job) {
            const reschedJobId = `${email.id}:resched:${new Date(email.scheduledAt).getTime()}`;
            job = await emailQueue.getJob(reschedJobId);
          }
          if (job) {
            await job.remove();
          }
        } catch (queueErr) {
          console.warn(`Could not remove job ${email.id} from queue during campaign delete:`, queueErr);
        }
      }
    }

    // Delete campaign (will cascade delete scheduled emails in database)
    await prisma.emailCampaign.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'Campaign and associated scheduled emails deleted successfully.' });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    return res.status(500).json({ error: 'Failed to delete campaign.' });
  }
}

function resolveCampaignStatusInternal(dbStatus: string, scheduledEmails: { status: string }[] = []) {
  if (scheduledEmails.length === 0) return dbStatus;

  const total = scheduledEmails.length;
  const sent = scheduledEmails.filter(e => e.status === 'SENT').length;
  const cancelled = scheduledEmails.filter(e => e.status === 'CANCELLED').length;
  const failed = scheduledEmails.filter(e => e.status === 'FAILED').length;
  const processing = scheduledEmails.filter(e => e.status === 'PROCESSING').length;
  const rateLimited = scheduledEmails.filter(e => e.status === 'RATE_LIMITED').length;

  if (sent === total) {
    return 'COMPLETED';
  }

  if (cancelled === total) {
    return 'CANCELLED';
  }

  if (sent + failed + cancelled === total) {
    return 'COMPLETED';
  }

  if (processing > 0 || rateLimited > 0 || (sent + failed > 0)) {
    return 'IN_PROGRESS';
  }

  return 'SCHEDULED';
}

export async function getQueueStatus(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const counts = await emailQueue.getJobCounts();
    
    // Get the 50 most recent jobs across typical states
    const rawJobs = await emailQueue.getJobs(['active', 'waiting', 'delayed', 'failed', 'completed'], 0, 49, true);

    const jobs = await Promise.all(
      rawJobs.map(async (job) => {
        const state = await job.getState();
        const emailId = job.data?.emailId;

        // Fetch corresponding email and campaign details from database if emailId exists
        let emailInfo = null;
        if (emailId) {
          try {
            emailInfo = await prisma.scheduledEmail.findUnique({
              where: { id: emailId },
              select: {
                recipient: true,
                subject: true,
                status: true,
                campaign: {
                  select: {
                    subject: true,
                  }
                },
                sender: {
                  select: {
                    name: true,
                    email: true,
                  }
                }
              }
            });
          } catch (dbErr) {
            // ignore
          }
        }

        return {
          id: job.id,
          name: job.name,
          state,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          delay: job.opts?.delay || 0,
          emailInfo,
        };
      })
    );

    return res.json({ counts, jobs });
  } catch (error: any) {
    console.error('Error fetching queue status:', error);
    return res.status(500).json({ error: 'Failed to fetch queue status.' });
  }
}

export async function retryQueueJob(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const job = await emailQueue.getJob(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in queue' });
    }

    await job.retry();
    return res.json({ success: true, message: 'Job retry scheduled successfully.' });
  } catch (error: any) {
    console.error('Error retrying job:', error);
    return res.status(500).json({ error: 'Failed to retry job.' });
  }
}

export async function removeQueueJob(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    const job = await emailQueue.getJob(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found in queue' });
    }

    await job.remove();
    return res.json({ success: true, message: 'Job removed from queue successfully.' });
  } catch (error: any) {
    console.error('Error removing job:', error);
    return res.status(500).json({ error: 'Failed to remove job.' });
  }
}

export async function cleanQueue(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { status } = req.body;

  if (!['completed', 'failed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid clean status' });
  }

  try {
    const jobs = await emailQueue.clean(0, 1000, status);
    return res.json({ success: true, message: `Cleaned ${jobs.length} jobs with status ${status}.` });
  } catch (error: any) {
    console.error('Error cleaning queue:', error);
    return res.status(500).json({ error: 'Failed to clean queue.' });
  }
}
