import { OAuth2Client } from 'google-auth-library';

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';

  if (!clientId || !clientSecret) {
    console.warn('Google Client ID or Secret is not configured. Google OAuth will fail.');
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
};

export function getGoogleAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'select_account',
  });
}

export interface GoogleUserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export async function getGoogleUserProfile(code: string): Promise<GoogleUserProfile> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  if (!tokens.id_token) {
    throw new Error('No ID token received from Google OAuth.');
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Invalid ID token payload from Google OAuth.');
  }

  return {
    id: payload.sub,
    name: payload.name || 'Google User',
    email: payload.email || '',
    avatar: payload.picture,
  };
}
