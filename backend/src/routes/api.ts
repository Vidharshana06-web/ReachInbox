import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  redirectToGoogle,
  handleGoogleCallback,
  getMe,
  logout
} from '../controllers/auth.controller.js';
import {
  getSenders,
  createSender,
  deleteSender
} from '../controllers/sender.controller.js';
import {
  scheduleCampaign,
  getScheduledEmails,
  getSentEmails,
  getEmailById,
  cancelEmail,
  getCampaignById,
  getCampaigns,
  deleteCampaign,
  getQueueStatus,
  retryQueueJob,
  removeQueueJob,
  cleanQueue
} from '../controllers/email.controller.js';
import {
  connectSlack,
  handleSlackCallback,
  getSlackStatus,
  disconnectSlack
} from '../controllers/slack.controller.js';
import { searchEmails } from '../controllers/search.controller.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// Authentication Routes
router.get('/auth/google', redirectToGoogle);
router.get('/auth/google/callback', handleGoogleCallback);
router.get('/auth/me', authMiddleware as any, getMe as any);
router.post('/auth/logout', logout);

// Senders Routes
router.get('/senders', authMiddleware as any, getSenders as any);
router.post('/senders', authMiddleware as any, createSender as any);
router.delete('/senders/:id', authMiddleware as any, deleteSender as any);

// Email Campaigns / Jobs Routes
router.post('/emails/schedule', authMiddleware as any, scheduleCampaign as any);
router.get('/emails/scheduled', authMiddleware as any, getScheduledEmails as any);
router.get('/emails/sent', authMiddleware as any, getSentEmails as any);
router.get('/emails/:id', authMiddleware as any, getEmailById as any);
router.post('/emails/:id/cancel', authMiddleware as any, cancelEmail as any);
router.get('/campaigns', authMiddleware as any, getCampaigns as any);
router.get('/campaigns/:id', authMiddleware as any, getCampaignById as any);
router.delete('/campaigns/:id', authMiddleware as any, deleteCampaign as any);

// Search Route
router.get('/search/emails', authMiddleware as any, searchEmails as any);

// Slack Integration Routes
router.get('/slack/connect', authMiddleware as any, connectSlack as any);
router.get('/slack/callback', handleSlackCallback as any);
router.get('/slack/status', authMiddleware as any, getSlackStatus as any);
router.post('/slack/disconnect', authMiddleware as any, disconnectSlack as any);

// Queue Management Routes
router.get('/queues', authMiddleware as any, getQueueStatus as any);
router.post('/queues/retry/:id', authMiddleware as any, retryQueueJob as any);
router.post('/queues/remove/:id', authMiddleware as any, removeQueueJob as any);
router.post('/queues/clean', authMiddleware as any, cleanQueue as any);

export default router;
