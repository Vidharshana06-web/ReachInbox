import axios from 'axios';
import { User, EmailSender, ScheduledEmail, EmailCampaign, SlackStatus, SearchResponse } from '../types/index.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('reachinbox_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const authAPI = {
  getGoogleAuthUrl: () => `${API_BASE_URL}/auth/google`,
  getMe: async () => {
    const response = await api.get<{ user: User; slackConnected: boolean }>('/auth/me');
    return response.data;
  },
  updateProfile: async (data: { name: string; avatar: string }) => {
    const response = await api.put<{ success: boolean; user: User }>('/auth/profile', data);
    return response.data;
  },
};

export const sendersAPI = {
  getSenders: async () => {
    const response = await api.get<{ senders: EmailSender[] }>('/senders');
    return response.data.senders;
  },
  createSender: async (data: { name: string; email: string }) => {
    const response = await api.post<{ sender: EmailSender }>('/senders', data);
    return response.data.sender;
  },
  deleteSender: async (id: string) => {
    const response = await api.delete(`/senders/${id}`);
    return response.data;
  },
};

export interface ScheduleCampaignData {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export const emailsAPI = {
  schedule: async (data: ScheduleCampaignData) => {
    const response = await api.post<{ success: boolean; campaignId: string; totalScheduled: number; duplicatesRemoved: number }>('/emails/schedule', data);
    return response.data;
  },
  getScheduled: async () => {
    const response = await api.get<{ emails: ScheduledEmail[] }>('/emails/scheduled');
    return response.data.emails;
  },
  getSent: async () => {
    const response = await api.get<{ emails: ScheduledEmail[] }>('/emails/sent');
    return response.data.emails;
  },
  getEmailById: async (id: string) => {
    const response = await api.get<{ email: ScheduledEmail }>(`/emails/${id}`);
    return response.data.email;
  },
  cancel: async (id: string) => {
    const response = await api.post<{ success: boolean; message: string }>(`/emails/${id}/cancel`);
    return response.data;
  },
};

export const slackAPI = {
  getConnectUrl: () => `${API_BASE_URL}/slack/connect`,
  getStatus: async () => {
    const response = await api.get<SlackStatus>('/slack/status');
    return response.data;
  },
  disconnect: async () => {
    const response = await api.post<{ success: boolean; message: string }>('/slack/disconnect');
    return response.data;
  },
};

export const searchAPI = {
  search: async (q: string) => {
    const response = await api.get<SearchResponse>(`/search/emails?q=${encodeURIComponent(q)}`);
    return response.data;
  },
};

export const campaignsAPI = {
  getCampaigns: async () => {
    const response = await api.get<{ campaigns: EmailCampaign[] }>('/campaigns');
    return response.data.campaigns;
  },
  getCampaignById: async (id: string) => {
    const response = await api.get<{ campaign: EmailCampaign & { sender?: EmailSender; scheduledEmails: ScheduledEmail[] } }>(`/campaigns/${id}`);
    return response.data.campaign;
  },
  deleteCampaign: async (id: string) => {
    const response = await api.delete(`/campaigns/${id}`);
    return response.data;
  },
};

export const queuesAPI = {
  getQueueStatus: async () => {
    const response = await api.get<{ counts: any; jobs: any[] }>('/queues');
    return response.data;
  },
  retryJob: async (id: string) => {
    const response = await api.post<{ success: boolean; message: string }>(`/queues/retry/${id}`);
    return response.data;
  },
  removeJob: async (id: string) => {
    const response = await api.post<{ success: boolean; message: string }>(`/queues/remove/${id}`);
    return response.data;
  },
  cleanQueue: async (status: 'completed' | 'failed') => {
    const response = await api.post<{ success: boolean; message: string }>('/queues/clean', { status });
    return response.data;
  },
};

export default api;
