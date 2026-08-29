import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { campaignsAPI, emailsAPI } from '../services/api.js';
import { EmailCampaign, ScheduledEmail, EmailSender } from '../types/index.js';
import { 
  ArrowLeft, Loader2, AlertCircle, Mail, Calendar, Clock, 
  Send, ShieldAlert, RefreshCw, Eye, CornerDownRight, X, AlertOctagon, CheckCircle2, Info
} from 'lucide-react';

interface CampaignWithRelations extends EmailCampaign {
  sender?: EmailSender;
  scheduledEmails: ScheduledEmail[];
}

export const JobDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchCampaign = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await campaignsAPI.getCampaignById(id);
      setCampaign(data);
      
      // Keep selected email updated if it was already selected
      if (selectedEmail && data.scheduledEmails) {
        const updated = data.scheduledEmails.find((e: ScheduledEmail) => e.id === selectedEmail.id);
        if (updated) {
          setSelectedEmail(updated);
        }
      }
    } catch (err: any) {
      console.error('Error fetching campaign details:', err);
      setError(err.response?.data?.error || 'Unable to retrieve campaign details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
  }, [id]);

  const handleCancelEmail = async (emailId: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      setActionLoading(emailId);
      await emailsAPI.cancel(emailId);
      // Reload campaign data
      const data = await campaignsAPI.getCampaignById(id!);
      setCampaign(data);
      const updated = data.scheduledEmails.find((e: ScheduledEmail) => e.id === emailId);
      if (updated) setSelectedEmail(updated);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel email.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !campaign) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-semibold">Loading campaign analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 max-w-lg mx-auto mt-10">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm mb-1">Failed to Load Campaign</h4>
            <p className="text-slate-505">{error}</p>
            <button 
              onClick={fetchCampaign}
              className="mt-3 px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-750 font-semibold rounded-lg transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  // Calculate statistics
  const emails = campaign.scheduledEmails || [];
  const stats = {
    total: emails.length,
    scheduled: emails.filter(e => e.status === 'SCHEDULED').length,
    processing: emails.filter(e => e.status === 'PROCESSING').length,
    sent: emails.filter(e => e.status === 'SENT').length,
    failed: emails.filter(e => e.status === 'FAILED').length,
    rateLimited: emails.filter(e => e.status === 'RATE_LIMITED').length,
    cancelled: emails.filter(e => e.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header and Back Link */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>Campaign Delivery Details</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded border border-indigo-200 bg-indigo-50 text-indigo-755">
              {campaign.status}
            </span>
          </h2>
          <p className="text-xs text-slate-550">Campaign ID: <span className="font-mono text-slate-700">{campaign.id}</span></p>
        </div>
        <button
          onClick={fetchCampaign}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-55 text-slate-600 hover:text-slate-900 transition-all text-xs font-semibold cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          <span>Refresh Details</span>
        </button>
      </div>

      {/* Main 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Sidebar (Campaign Details & Stats) */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Campaign Details */}
          <div className="glass-panel p-5 rounded-xl space-y-4">
            <h3 className="font-bold text-xs text-indigo-650 uppercase tracking-wider border-b border-slate-100 pb-2">
              📋 Campaign Info
            </h3>
            
            <div className="space-y-3.5 text-xs text-slate-700">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Subject Line</span>
                <p className="font-semibold text-slate-900 leading-normal" title={campaign.subject}>{campaign.subject}</p>
              </div>
              
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sender Account</span>
                <p className="font-medium text-slate-800 break-all">
                  {campaign.sender ? `${campaign.sender.name} (${campaign.sender.email})` : 'N/A'}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Scheduled Start</span>
                <p className="font-mono text-slate-700 text-[11px]">
                  {new Date(campaign.startTime).toLocaleString()}
                </p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Created At</span>
                <p className="font-mono text-slate-700 text-[11px]">
                  {new Date(campaign.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-center">
                  <div className="text-[9px] text-slate-450 font-bold uppercase">Delay</div>
                  <div className="font-bold text-slate-800 mt-0.5 text-xs">{campaign.delayBetweenEmails / 1000}s</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/60 text-center">
                  <div className="text-[9px] text-slate-450 font-bold uppercase">Limit/Hr</div>
                  <div className="font-bold text-slate-800 mt-0.5 text-xs">{campaign.hourlyLimit}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Summary List in Sidebar */}
          <div className="glass-panel p-5 rounded-xl space-y-3">
            <h3 className="font-bold text-xs text-indigo-650 uppercase tracking-wider border-b border-slate-100 pb-2">
              📊 Delivery Summary
            </h3>
            
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                <span className="text-slate-600 font-medium">Total Emails</span>
                <span className="font-extrabold text-slate-900 text-sm">{stats.total}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-amber-50/40 border border-amber-200">
                <span className="text-amber-705 font-medium">Scheduled (Waiting)</span>
                <span className="font-extrabold text-amber-700 text-sm">{stats.scheduled}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-indigo-50/40 border border-indigo-200">
                <span className="text-indigo-705 font-medium">Processing</span>
                <span className="font-extrabold text-indigo-700 text-sm">{stats.processing}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-emerald-50/40 border border-emerald-200">
                <span className="text-emerald-705 font-medium">Sent (Success)</span>
                <span className="font-extrabold text-emerald-700 text-sm">{stats.sent}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-rose-50/40 border border-rose-200">
                <span className="text-rose-705 font-medium">Failed</span>
                <span className="font-extrabold text-rose-700 text-sm">{stats.failed}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-purple-50/40 border border-purple-200">
                <span className="text-purple-705 font-medium">Rate Limited</span>
                <span className="font-extrabold text-purple-700 text-sm">{stats.rateLimited}</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-200">
                <span className="text-slate-600 font-medium">Cancelled</span>
                <span className="font-extrabold text-slate-800 text-sm">{stats.cancelled}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Side: Main Content Area (Recipient Table & Inspector Panel) */}
        <div className={`lg:col-span-3 grid grid-cols-1 ${selectedEmail ? 'xl:grid-cols-5' : ''} gap-6`}>
          
          {/* Recipient Details Table */}
          <div className={`glass-panel rounded-xl overflow-hidden ${selectedEmail ? 'xl:col-span-3' : 'w-full'}`}>
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <h3 className="font-bold text-xs text-indigo-650 uppercase tracking-wider">
                👥 Campaign Recipients
              </h3>
            </div>

            {emails.length === 0 ? (
              <div className="text-center py-20 text-slate-500 text-xs italic">
                No recipients scheduled.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[550px]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50">
                      <th className="py-3 px-4">Recipient</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((emailItem) => {
                      const isSelected = selectedEmail?.id === emailItem.id;
                      return (
                        <tr 
                          key={emailItem.id} 
                          onClick={() => setSelectedEmail(emailItem)}
                          className={`border-b border-slate-200 hover:bg-slate-55 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-500/5 border-l-2 border-l-indigo-600' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-slate-800 truncate max-w-[130px]">
                            {emailItem.recipient}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              emailItem.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              emailItem.status === 'FAILED' ? 'bg-rose-55 border border-rose-200 text-rose-700' :
                              emailItem.status === 'RATE_LIMITED' ? 'bg-purple-55 border border-purple-200 text-purple-700' :
                              emailItem.status === 'PROCESSING' ? 'bg-indigo-55 border border-indigo-200 text-indigo-700 animate-pulse' :
                              emailItem.status === 'CANCELLED' ? 'bg-slate-100 text-slate-655 border border-slate-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {emailItem.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setSelectedEmail(emailItem)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-all cursor-pointer text-[10px]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Inspect</span>
                            </button>
                            {(emailItem.status === 'SCHEDULED' || emailItem.status === 'RATE_LIMITED') && (
                              <button
                                onClick={() => handleCancelEmail(emailItem.id)}
                                disabled={actionLoading === emailItem.id}
                                className="px-2 py-1 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-bold rounded transition-all cursor-pointer text-[10px] disabled:opacity-50"
                              >
                                {actionLoading === emailItem.id ? '...' : 'Cancel'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Selected Email Panel Details */}
          {selectedEmail && (
            <div className="xl:col-span-2 glass-panel p-5 rounded-xl space-y-5 animate-in fade-in slide-in-from-right-4 duration-300 self-start">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-indigo-650" />
                  <h3 className="font-bold text-xs text-slate-805 uppercase tracking-wider">
                    Recipient Details
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedEmail(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lifecycle Timeline */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">
                  Delivery Lifecycle State
                </span>
                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-500">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px]">✓</div>
                    <span>Created</span>
                  </div>
                  <div className="text-slate-300">→</div>
                  
                  {selectedEmail.status === 'CANCELLED' ? (
                    <>
                      <div className="flex flex-col items-center gap-1 text-slate-400">
                        <div className="w-4 h-4 rounded-full bg-slate-300 text-white flex items-center justify-center text-[8px]">!</div>
                        <span>Cancelled</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col items-center gap-1 text-emerald-600">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px]">✓</div>
                        <span>Scheduled</span>
                      </div>
                      <div className="text-slate-300">→</div>

                      {selectedEmail.status === 'RATE_LIMITED' ? (
                        <>
                          <div className="flex flex-col items-center gap-1 text-purple-650">
                            <div className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[8px] animate-pulse">!</div>
                            <span>Limited</span>
                          </div>
                          <div className="text-slate-300">→</div>
                          <div className="flex flex-col items-center gap-1 text-slate-400">
                            <div className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[8px]">?</div>
                            <span>Resched</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className={`flex flex-col items-center gap-1 ${
                            selectedEmail.status === 'SENT' || selectedEmail.status === 'FAILED' ? 'text-emerald-600' : 'text-indigo-655'
                          }`}>
                            <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] ${
                              selectedEmail.status === 'SENT' || selectedEmail.status === 'FAILED' ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white animate-pulse'
                            }`}>
                              {selectedEmail.status === 'SENT' || selectedEmail.status === 'FAILED' ? '✓' : '•'}
                            </div>
                            <span>Process</span>
                          </div>
                          <div className="text-slate-300">→</div>
                          
                          {selectedEmail.status === 'SENT' ? (
                            <div className="flex flex-col items-center gap-1 text-emerald-600">
                              <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px]">✓</div>
                              <span>Sent</span>
                            </div>
                          ) : selectedEmail.status === 'FAILED' ? (
                            <div className="flex flex-col items-center gap-1 text-rose-600">
                              <div className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px]">✗</div>
                              <span>Failed</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              <div className="w-4 h-4 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[8px]">?</div>
                              <span>Sent</span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Data Properties */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-655">
                <div className="flex items-start gap-1">
                  <span className="font-semibold text-slate-450 w-16 shrink-0">Recipient:</span>
                  <span className="text-slate-800 select-all font-semibold break-all">{selectedEmail.recipient}</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="font-semibold text-slate-455 w-16 shrink-0">Subject:</span>
                  <span className="text-slate-800 font-medium">{selectedEmail.subject}</span>
                </div>
                <div className="flex items-start gap-1">
                  <span className="font-semibold text-slate-455 w-16 shrink-0">Scheduled:</span>
                  <span className="text-slate-650 font-mono">
                    {new Date(selectedEmail.scheduledAt).toLocaleString()}
                  </span>
                </div>
                {selectedEmail.sentAt && (
                  <div className="flex items-start gap-1">
                    <span className="font-semibold text-slate-455 w-16 shrink-0">Sent At:</span>
                    <span className="text-slate-650 font-mono">
                      {new Date(selectedEmail.sentAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedEmail.errorMessage && (
                  <div className="pt-2 border-t border-slate-200 text-rose-650 space-y-1">
                    <span className="font-semibold uppercase text-[9px] tracking-wider text-rose-500 block">
                      ⚠ Delivery Error Details
                    </span>
                    <p className="bg-rose-50 p-2 rounded border border-rose-200 font-mono text-[10px] whitespace-pre-wrap leading-relaxed select-all">
                      {selectedEmail.errorMessage}
                    </p>
                  </div>
                )}
              </div>

              {/* Body Sandbox */}
              <div className="space-y-1">
                <span className="text-[10px] text-slate-550 font-semibold uppercase tracking-wider block">
                  Email Body Content Preview
                </span>
                <div className="w-full h-44 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <iframe
                    title="Email Body Preview"
                    sandbox="allow-popups"
                    className="w-full h-full bg-white p-2 border-none"
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <style>
                            body {
                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                              font-size: 13px;
                              line-height: 1.5;
                              color: #1e293b;
                              background-color: #ffffff;
                              margin: 8px;
                            }
                            a { color: #4f46e5; }
                          </style>
                        </head>
                        <body>
                          ${selectedEmail.body}
                        </body>
                      </html>
                    `}
                  />
                </div>
              </div>

              {/* Ethereal Link */}
              {selectedEmail.status === 'SENT' && selectedEmail.previewUrl && (
                <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-between gap-4">
                  <div className="text-[11px]">
                    <p className="font-bold text-indigo-700">SMTP Server Log Captured</p>
                    <p className="text-slate-505 mt-0.5">Fake SMTP capture portal link.</p>
                  </div>
                  <a
                    href={selectedEmail.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-[11px] font-bold text-white transition-all shadow-sm cursor-pointer"
                  >
                    <span>Ethereal Log</span>
                    <CornerDownRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
