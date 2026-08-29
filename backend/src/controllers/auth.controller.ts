import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { getGoogleAuthUrl, getGoogleUserProfile } from '../integrations/google.auth.js';
import { prisma } from '../config/db.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export async function redirectToGoogle(req: any, res: Response) {
  try {
    const url = getGoogleAuthUrl();
    return res.redirect(url);
  } catch (error: any) {
    console.error('Error generating Google auth URL:', error);
    return res.status(500).json({ error: 'Failed to generate authentication URL' });
  }
}

export async function handleGoogleCallback(req: any, res: Response) {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
  }

  try {
    const googleUser = await getGoogleUserProfile(code);
    
    // Find or create user in MySQL via Prisma
    let user = await prisma.user.findUnique({
      where: { googleId: googleUser.id },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: googleUser.id,
          name: googleUser.name,
          email: googleUser.email,
          avatar: googleUser.avatar,
        },
      });
    } else {
      // Update avatar or name if they changed
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: googleUser.name,
          avatar: googleUser.avatar || user.avatar,
        },
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        googleId: user.googleId,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect user back to the SPA with token
    return res.redirect(`${FRONTEND_URL}/login?token=${token}`);
  } catch (error: any) {
    console.error('Error in Google OAuth callback:', error);
    return res.redirect(`${FRONTEND_URL}/login?error=auth_failed`);
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        slackAccessToken: true,
        slackChannelName: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user,
      slackConnected: !!user.slackAccessToken,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Database query failed' });
  }
}

export async function logout(req: AuthRequest, res: Response) {
  return res.json({ success: true, message: 'Logged out successfully' });
}
