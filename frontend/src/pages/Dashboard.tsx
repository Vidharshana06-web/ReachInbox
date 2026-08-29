import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendersAPI, emailsAPI, slackAPI, searchAPI } from '../services/api.js';
import { EmailSender, ScheduledEmail, SlackStatus } from '../types/index.js';
import { SendersManager } from '../components/SendersManager.js';
import { ComposeEmailModal } from '../components/ComposeEmailModal.js';
import { EmailPreviewModal } from '../components/EmailPreviewModal.js';
import { useAuth } from '../context/AuthContext.js';
import { 
  Mail, Calendar, Send, ShieldAlert, CheckCircle, 
  Search, Plus, Hash, Power, RefreshCw, ExternalLink, AlertOctagon,
  Loader2, MailQuestion, Eye, AlertCircle, CheckCircle2, Info, X
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmail[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Slack Connection state
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackChannel, setSlackChannel] = useState<string | null>(null);
  const [slackLoading, setSlackLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<ScheduledEmail[]>([]);
  const [searchSource, setSearchSource] = useState<'elasticsearch' | 'mysql_fallback' | null>(null);

  // Compose Campaign Modal state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');

  // Preview Modal state
  const [previewEmailId, setPreviewEmailId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Notification Toast state
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.message === message ? null : curr));
    }, 6000);
  };

  // Load and refresh lists
  const fetchAllData = async () => {
    try {
      setLoadingList(true);
      const [schedList, sentList] = await Promise.all([
        emailsAPI.getScheduled(),
        emailsAPI.getSent(),
      ]);
      setScheduledEmails(schedList);
      setSentEmails(sentList);
    } catch (err) {
      console.error('Error fetching dashboard lists:', err);
      showNotification('Failed to retrieve email listings.', 'error');
    } finally {
      setLoadingList(false);
    }
  };

  const fetchSlackStatus = async () => {
    try {
      setSlackLoading(true);
      const status = await slackAPI.getStatus();
      setSlackConnected(status.connected);
      setSlackChannel(status.channel);
    } catch (err) {
      console.error('Error checking Slack integration status:', err);
    } finally {
      setSlackLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchSlackStatus();

    // Check Slack integration callback params
    const params = new URLSearchParams(window.location.search);
    const slackSuccess = params.get('slack_success');
    const slackError = params.get('slack_error');
    if (slackSuccess) {
      showNotification('Slack alerts integration successfully connected!', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (slackError) {
      let msg = 'Slack connection failed. Please check your Slack configuration.';
      if (slackError === 'missing_config') {
        msg = 'Slack connection failed: Missing Slack App configuration (Client ID, Secret, or Redirect URI) in .env file.';
      } else if (slackError === 'exchange_failed' || slackError === 'server_error') {
        msg = `Slack connection failed: OAuth exchange error (${slackError}).`;
      }
      showNotification(msg, 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Auto-refresh tables every 10 seconds to watch the scheduler execute tasks live
    const interval = setInterval(() => {
      fetchAllData();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Debounced search logic (wait 400ms after typing finishes before calling ES)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchSource(null);
      return;
    }

    setSearchLoading(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const results = await searchAPI.search(searchQuery);
        setSearchResults(results.emails);
        setSearchSource(results.source);
      } catch (err) {
        console.error('Elasticsearch search failure:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleSlackConnect = () => {
    const token = localStorage.getItem('reachinbox_token');
    window.location.href = `${slackAPI.getConnectUrl()}?token=${encodeURIComponent(token || '')}`;
  };

  const handleSlackDisconnect = async () => {
    if (!window.confirm('Disconnect Slack alerts integration?')) return;
    try {
      setSlackLoading(true);
      await slackAPI.disconnect();
      setSlackConnected(false);
      setSlackChannel(null);
      showNotification('Slack alerts integration disconnected.', 'info');
    } catch (err) {
      showNotification('Failed to disconnect Slack.', 'error');
    } finally {
      setSlackLoading(false);
    }
  };

  const handleCancelEmail = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email job?')) return;
    try {
      await emailsAPI.cancel(id);
      showNotification('Scheduled email job was successfully cancelled.', 'success');
      await fetchAllData();
    } catch (err: any) {
      showNotification(err.response?.data?.error || 'Failed to cancel email.', 'error');
    }
  };

  const handleCampaignScheduled = (stats: { totalScheduled: number; duplicatesRemoved: number }) => {
    const totalRaw = stats.totalScheduled + stats.duplicatesRemoved;
    showNotification(
      `${totalRaw} recipients uploaded, ${stats.duplicatesRemoved} duplicates removed, ${stats.totalScheduled} emails scheduled.`,
      'success'
    );
    fetchAllData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-indigo-500/10 text-indigo-650 rounded-lg">
            <Mail className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{senders.length}</div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Senders</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-yellow-500/10 text-yellow-600 rounded-lg">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">{scheduledEmails.length}</div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Scheduled</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-650 rounded-lg">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {sentEmails.filter(e => e.status === 'SENT').length}
            </div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider font-medium">Sent</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-650 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900">
              {sentEmails.filter(e => e.status === 'FAILED').length}
            </div>
            <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Failed</div>
          </div>
        </div>
      </div>

      {/* Slack Connector & Main Control Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Senders manager */}
        <div className="lg:col-span-1">
          <SendersManager onSendersUpdated={setSenders} />
        </div>

        {/* Right Side: Slack status integration & composing action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500/5 text-indigo-650 border border-indigo-500/10 rounded-xl">
                <Hash className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Slack Alerts Integration</h3>
                <p className="text-xs text-slate-500 leading-normal max-w-sm mt-0.5">
                  Receive a real-time Slack channel notification immediately when any sending sender reaches its hourly limit.
                </p>
              </div>
            </div>

            {slackLoading ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
              </div>
            ) : slackConnected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-705 border border-emerald-200 text-xs font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Active Alerts</span>
                </span>
                <button
                  onClick={handleSlackDisconnect}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all text-xs font-medium cursor-pointer"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleSlackConnect}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#4A154B] hover:bg-[#3F103F] text-xs font-bold text-white transition-all shadow-md shadow-[#4A154B]/20 cursor-pointer"
              >
                {/* Slack Icon SVG */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#e01e5a" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.042z"/>
                  <path fill="#36c5f0" d="M8.823 5.043a2.528 2.528 0 0 1-2.52-2.52 2.528 2.528 0 0 1 2.52-2.523 2.528 2.528 0 0 1 2.522 2.523v2.52h-2.522zm0 1.26a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H3.78a2.528 2.528 0 0 1-2.522-2.52V8.823a2.528 2.528 0 0 1 2.522-2.52h5.043z"/>
                  <path fill="#2eb67d" d="M18.958 8.823a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52 2.528 2.528 0 0 1-2.522 2.52h-2.52v-2.52zm-1.26 0a2.528 2.528 0 0 1-2.522 2.52h-5.043a2.528 2.528 0 0 1-2.52-2.52V3.781a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.042z"/>
                  <path fill="#ecb22e" d="M15.165 18.958a2.528 2.528 0 0 1 2.522 2.52 2.528 2.528 0 0 1-2.522 2.522 2.528 2.528 0 0 1-2.52-2.522v-2.52h2.52zm0-1.26a2.528 2.528 0 0 1-2.522-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043h-5.043z"/>
                </svg>
                <span>Connect Slack</span>
              </button>
            )}
          </div>

          {/* Action Bar: Search input & Compose button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search recipient, body, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg bg-white border border-slate-200 focus:outline-none focus:border-indigo-500 transition-colors text-slate-800"
              />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-indigo-550 animate-spin" />
              )}
            </div>

            {/* Compose Campaign Button */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={fetchAllData}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 transition-all cursor-pointer"
                title="Refresh lists"
              >
                <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin text-indigo-550' : ''}`} />
              </button>
              
              <button
                onClick={() => setIsComposeOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Compose Campaign</span>
              </button>
            </div>
          </div>

          {/* Elasticsearch Search Matches Container */}
          {searchQuery.trim().length > 0 && (
            <div className="glass-panel p-6 rounded-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-bold text-xs text-indigo-650 uppercase tracking-wider">
                  🔍 Live Search Results
                </h3>
                {searchSource && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700">
                    Source: {searchSource === 'elasticsearch' ? 'Elasticsearch Engine' : 'MySQL Database'}
                  </span>
                )}
              </div>

              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No matching emails found for "{searchQuery}"
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                        <th className="py-2.5 px-3">Recipient</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3">Sender</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchResults.map((email) => (
                        <tr key={email.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-800">{email.recipient}</td>
                          <td className="py-3 px-3 text-slate-650">{email.subject}</td>
                          <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{email.sender?.email || 'N/A'}</td>
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              email.status === 'SENT' ? 'bg-emerald-50 text-emerald-705 border border-emerald-200' :
                              email.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              email.status === 'RATE_LIMITED' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {email.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-medium space-x-3">
                            <button
                              onClick={() => navigate(`/jobs/${email.campaignId}`)}
                              className="text-xs font-semibold text-indigo-650 hover:text-indigo-750 transition-colors cursor-pointer"
                            >
                              Details
                            </button>
                            <button
                              onClick={() => {
                                setPreviewEmailId(email.id);
                                setIsPreviewOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Preview</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Standard Scheduled vs Sent tabs */}
          {searchQuery.trim().length === 0 && (
            <div className="glass-panel rounded-xl overflow-hidden">
              <div className="flex border-b border-slate-200 bg-slate-50">
                <button
                  onClick={() => setActiveTab('scheduled')}
                  className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 cursor-pointer ${
                    activeTab === 'scheduled'
                      ? 'border-indigo-650 text-indigo-650 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Scheduled Queue ({scheduledEmails.length})
                </button>
                <button
                  onClick={() => setActiveTab('sent')}
                  className={`flex-1 py-3 text-xs font-bold text-center transition-all border-b-2 cursor-pointer ${
                    activeTab === 'sent'
                      ? 'border-indigo-650 text-indigo-650 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Completed Delivery ({sentEmails.length})
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'scheduled' ? (
                  /* Scheduled table */
                  loadingList ? (
                    <div className="flex items-center justify-center py-10 text-slate-500 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading scheduled queue...
                    </div>
                  ) : scheduledEmails.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 flex flex-col items-center justify-center gap-2">
                      <MailQuestion className="w-8 h-8 text-slate-600" />
                      <p className="text-xs">No scheduled emails in queue. Create a campaign to begin!</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-555 font-semibold bg-slate-50">
                            <th className="py-2.5 px-3">Recipient</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Sender</th>
                            <th className="py-2.5 px-3">Scheduled At</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduledEmails.map((email) => (
                            <tr key={email.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors">
                              <td className="py-3.5 px-3 font-semibold text-slate-805">{email.recipient}</td>
                              <td className="py-3.5 px-3 text-slate-650 max-w-[150px] truncate">{email.subject}</td>
                              <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">{email.sender?.email}</td>
                              <td className="py-3.5 px-3 text-slate-550 font-mono text-[11px]">
                                {new Date(email.scheduledAt).toLocaleString()}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  email.status === 'RATE_LIMITED' 
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                    : email.status === 'PROCESSING'
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {email.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 text-right font-medium space-x-3">
                                <button
                                  onClick={() => navigate(`/jobs/${email.campaignId}`)}
                                  className="text-xs font-semibold text-indigo-650 hover:text-indigo-750 transition-colors cursor-pointer"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => handleCancelEmail(email.id)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  /* Sent / completed table */
                  loadingList ? (
                    <div className="flex items-center justify-center py-10 text-slate-500 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Loading completed delivery logs...
                    </div>
                  ) : sentEmails.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 flex flex-col items-center justify-center gap-2">
                      <MailQuestion className="w-8 h-8 text-slate-600" />
                      <p className="text-xs">No email delivery activities recorded yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-555 font-semibold bg-slate-50">
                            <th className="py-2.5 px-3">Recipient</th>
                            <th className="py-2.5 px-3">Subject</th>
                            <th className="py-2.5 px-3">Sender</th>
                            <th className="py-2.5 px-3">Timestamp</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3 text-right font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sentEmails.map((email) => (
                            <tr key={email.id} className="border-b border-slate-200 hover:bg-slate-55 transition-colors">
                              <td className="py-3.5 px-3 font-semibold text-slate-805">{email.recipient}</td>
                              <td className="py-3.5 px-3 text-slate-650 max-w-[150px] truncate">{email.subject}</td>
                              <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">{email.sender?.email}</td>
                              <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                                {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'N/A'}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  email.status === 'SENT' 
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : 'bg-rose-55 border border-rose-200 text-rose-700'
                                }`}>
                                  {email.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 text-right font-medium space-x-3">
                                <button
                                  onClick={() => navigate(`/jobs/${email.campaignId}`)}
                                  className="text-xs font-semibold text-indigo-655 hover:text-indigo-750 transition-colors cursor-pointer"
                                >
                                  Details
                                </button>
                                {email.status === 'SENT' ? (
                                  <button
                                    onClick={() => {
                                      setPreviewEmailId(email.id);
                                      setIsPreviewOpen(true);
                                    }}
                                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 font-semibold cursor-pointer transition-colors"
                                  >
                                    <span>Preview</span>
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                ) : email.status === 'FAILED' ? (
                                  <span className="text-rose-600 cursor-help font-semibold text-[10px]" title={email.errorMessage || 'Unknown Error'}>
                                    Error Details
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 max-w-md animate-in fade-in slide-in-from-top-4 ${
          notification.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : notification.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-700'
            : 'bg-indigo-50 border-indigo-200 text-indigo-750'
        }`}>
          <div className="flex items-start gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            ) : notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-605" />
            ) : (
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-650" />
            )}
            <span className="text-xs font-semibold leading-relaxed">{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="p-0.5 rounded text-slate-400 hover:text-slate-805 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Campaign Composing Modal */}
      <ComposeEmailModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        senders={senders}
        onCampaignScheduled={handleCampaignScheduled}
      />

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewEmailId(null);
        }}
        emailId={previewEmailId}
      />
    </div>
  );
};
