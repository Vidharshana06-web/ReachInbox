import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/db.js';
import { getSlackAuthUrl, exchangeSlackCode } from '../integrations/slack.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function connectSlack(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return res.redirect(`${FRONTEND_URL}/dashboard?slack_error=missing_config`);
  }

  const authUrl = getSlackAuthUrl(userId);
  return res.redirect(authUrl);
}

export async function handleSlackCallback(req: AuthRequest, res: Response) {
  const code = req.query.code as string;
  const state = req.query.state as string; // User ID passed in state

  const userId = state || req.user?.id;
  
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/dashboard?slack_error=no_code`);
  }

  if (!userId) {
    return res.redirect(`${FRONTEND_URL}/login?slack_error=unauthenticated`);
  }

  try {
    const oauthResult = await exchangeSlackCode(code);

    if (!oauthResult.ok) {
      return res.redirect(`${FRONTEND_URL}/dashboard?slack_error=${oauthResult.error || 'exchange_failed'}`);
    }

    // Save tokens and webhook details to User record
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: oauthResult.access_token || null,
        slackChannelId: oauthResult.incoming_webhook?.url || oauthResult.incoming_webhook?.channel_id || null,
        slackChannelName: oauthResult.incoming_webhook?.channel || 'Connected Slack App',
      },
    });

    return res.redirect(`${FRONTEND_URL}/dashboard?slack_success=true`);
  } catch (error: any) {
    console.error('Error handling Slack OAuth callback:', error);
    return res.redirect(`${FRONTEND_URL}/dashboard?slack_error=server_error`);
  }
}

export async function getSlackStatus(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        slackAccessToken: true,
        slackChannelName: true,
      },
    });

    return res.json({
      connected: !!user?.slackAccessToken,
      channel: user?.slackChannelName || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to retrieve Slack status' });
  }
}

export async function disconnectSlack(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        slackAccessToken: null,
        slackChannelId: null,
        slackChannelName: null,
      },
    });
    return res.json({ success: true, message: 'Slack integration disconnected successfully.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to disconnect Slack integration' });
  }
}
