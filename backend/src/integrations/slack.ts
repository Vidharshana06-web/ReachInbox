import axios from 'axios';

interface SlackTokenExchangeResult {
  ok: boolean;
  access_token?: string;
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
  error?: string;
}

export function getSlackAuthUrl(userId: string): string {
  const clientId = process.env.SLACK_CLIENT_ID || '';
  const redirectUri = process.env.SLACK_REDIRECT_URI || '';
  // Request incoming-webhook so we get an easy webhook url to post alerts,
  // and chat:write to post using bot token if needed.
  return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=incoming-webhook,chat:write&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
}

export async function exchangeSlackCode(code: string): Promise<SlackTokenExchangeResult> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  try {
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: clientId || '',
        client_secret: clientSecret || '',
        code,
        redirect_uri: redirectUri || '',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (response.data.ok) {
      return {
        ok: true,
        access_token: response.data.access_token,
        incoming_webhook: response.data.incoming_webhook,
      };
    } else {
      console.error('Slack OAuth token exchange error:', response.data.error);
      return {
        ok: false,
        error: response.data.error,
      };
    }
  } catch (error: any) {
    console.error('Slack OAuth token exchange failed:', error.message || error);
    return {
      ok: false,
      error: error.message || 'Unknown network error during Slack token exchange',
    };
  }
}

export async function sendSlackRateLimitNotification(
  accessToken: string,
  channelId: string,
  senderEmail: string,
  nextAvailableHour: string
): Promise<boolean> {
  try {
    const text = `⚠️ *Email rate limit reached for ${senderEmail}*\n\nThe remaining scheduled emails have been moved to the next available sending window starting around *${nextAvailableHour}*.`;
    
    // We can support posting to webhook (if channelId is a webhook url starting with http)
    // or standard chat.postMessage api
    if (channelId.startsWith('http')) {
      await axios.post(channelId, { text });
      return true;
    }

    const response = await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: channelId,
        text,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );

    if (response.data.ok) {
      return true;
    } else {
      console.error('Slack API chat.postMessage failed:', response.data.error);
      return false;
    }
  } catch (error: any) {
    console.error('Failed to send Slack notification:', error.message || error);
    return false;
  }
}
