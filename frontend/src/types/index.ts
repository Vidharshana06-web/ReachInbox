export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  slackAccessToken?: string;
  slackChannelName?: string;
}

export interface EmailSender {
  id: string;
  userId: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaign {
  id: string;
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'RATE_LIMITED' | 'CANCELLED';
  attempts: number;
  bullJobId?: string;
  idempotencyKey: string;
  errorMessage?: string;
  previewUrl?: string;
  createdAt: string;
  updatedAt: string;
  sender?: EmailSender;
}

export interface SlackStatus {
  connected: boolean;
  channel: string | null;
}

export interface SearchResponse {
  source: 'elasticsearch' | 'mysql_fallback';
  emails: ScheduledEmail[];
}
