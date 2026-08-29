import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/db.js';

export async function getSenders(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const senders = await prisma.emailSender.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ senders });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve senders' });
  }
}

export async function createSender(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required fields' });
  }

  // Basic email regex validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address format' });
  }

  try {
    const sender = await prisma.emailSender.create({
      data: {
        userId,
        name,
        email,
      },
    });
    return res.status(201).json({ sender });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create sender' });
  }
}

export async function deleteSender(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;

  try {
    // Verify ownership before deleting
    const sender = await prisma.emailSender.findFirst({
      where: { id, userId },
    });

    if (!sender) {
      return res.status(404).json({ error: 'Sender not found or unauthorized' });
    }

    await prisma.emailSender.delete({
      where: { id },
    });

    return res.json({ success: true, message: 'Sender deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete sender' });
  }
}
