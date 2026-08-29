import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { campaignsAPI, emailsAPI } from '../services/api.js';
import { EmailCampaign, ScheduledEmail, EmailSender } from '../types/index.js';
import {
  Loader2, AlertCircle, Mail, Calendar, Clock,
  Send, RefreshCw, Eye, CornerDownRight, X, User, LayoutDashboard, Layers, ChevronRight, Trash2
} from 'lucide-react';

interface CampaignWithRelations extends EmailCampaign {
  sender?: EmailSender;
  scheduledEmails: ScheduledEmail[];
}

export const JobsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignsError, setCampaignsError] = useState<string | null>(null);

  const [campaign, setCampaign] = useState<CampaignWithRelations | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this campaign? This will cancel all of its pending emails and completely remove its logs.'
    );
    if (!confirmDelete) return;

    try {
      setDeleteLoading(true);
      await campaignsAPI.deleteCampaign(campaign.id);
      setSelectedEmail(null);
      setCampaign(null);
      await fetchCampaigns(false);
      navigate('/jobs', { replace: true });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete campaign.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Fetch all campaigns list
  const fetchCampaigns = async (selectFirst = false) => {
    try {
      setCampaignsLoading(true);
      setCampaignsError(null);
      const data = await campaignsAPI.getCampaigns();
      setCampaigns(data);

      if (selectFirst && data.length > 0 && !id) {
        navigate(`/jobs/${data[0].id}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Error fetching campaigns:', err);
      setCampaignsError(err.response?.data?.error || 'Failed to retrieve campaigns list.');
    } finally {
      setCampaignsLoading(false);
    }
  };

  // Fetch details of specific campaign
  const fetchCampaignDetails = async (campaignId: string) => {
    try {
      setDetailsLoading(true);
      setDetailsError(null);
      const data = await campaignsAPI.getCampaignById(campaignId);
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
      setDetailsError(err.response?.data?.error || 'Unable to retrieve campaign details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns(true);
  }, []);

  useEffect(() => {
    if (id) {
      fetchCampaignDetails(id);
    } else {
      setCampaign(null);
      setSelectedEmail(null);
    }
  }, [id]);

  const handleCancelEmail = async (emailId: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      setActionLoading(emailId);
      await emailsAPI.cancel(emailId);
      if (id) {
        // Reload details
        const data = await campaignsAPI.getCampaignById(id);
        setCampaign(data);
        const updated = data.scheduledEmails.find((e: ScheduledEmail) => e.id === emailId);
        if (updated) setSelectedEmail(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel email.');
    } finally {
      setActionLoading(null);
    }
  };

  // Helper stats
  const emails = campaign?.scheduledEmails || [];
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
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-slate-900">Campaign Job Explorer</h2>
          <p className="text-xs text-slate-500">Monitor scheduler status, delivery timelines, and recipient queues.</p>
        </div>
      </div>

      <div className="flex bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[600px] h-[calc(100vh-12rem)]">
        {/* Left Sub-sidebar: Campaigns list */}
        <div className="w-80 border-r border-slate-200 bg-slate-50/20 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-550 uppercase tracking-wider">Jobs List</span>
            <button
              onClick={() => fetchCampaigns(false)}
              className="p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              title="Refresh List"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${campaignsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {campaignsLoading && campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-450 gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                <p className="text-[10px] font-semibold">Loading campaigns...</p>
              </div>
            ) : campaignsError ? (
              <div className="p-3 text-[11px] text-rose-650 bg-rose-50 border border-rose-100 rounded-lg">
                {campaignsError}
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs italic p-4">
                No campaigns created yet. Click 'Compose Campaign' on the Dashboard to get started!
              </div>
            ) : (
              campaigns.map((c) => {
                const isActive = c.id === id;
                return (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/jobs/${c.id}`)}
                    className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${isActive
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm shadow-indigo-100/50'
                      : 'border-slate-100 bg-white hover:bg-slate-50/70 text-slate-700 hover:border-slate-200'
                      }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-bold truncate text-slate-900 leading-snug">{c.subject}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">
                        Sender: {c.senderId || 'N/A'}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[9px] font-mono text-slate-400">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </span>
                        <span className={`inline-block px-1.5 py-0.25 rounded text-[8px] font-extrabold ${c.status === 'SCHEDULED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          c.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                            c.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse' :
                              c.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600 border border-slate-200' :
                                'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          }`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 mt-0.5 transition-transform ${isActive ? 'text-indigo-605 translate-x-0.5' : 'text-slate-400'}`} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Main Details panel */}
        <div className="flex-1 overflow-y-auto bg-white flex flex-col">
          {detailsLoading && !campaign ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-550 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-semibold">Retrieving job metrics...</p>
            </div>
          ) : detailsError ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 max-w-lg">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm mb-1">Failed to Load Campaign Details</h4>
                  <p className="text-slate-500">{detailsError}</p>
                </div>
              </div>
            </div>
          ) : !campaign ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2.5 p-6">
              <Layers className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-medium">Select a campaign job from the list to view live tracking.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Campaign Header Area */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <span className="truncate max-w-[400px]" title={campaign.subject}>{campaign.subject}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${campaign.status === 'SCHEDULED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      campaign.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        campaign.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse' :
                          campaign.status === 'CANCELLED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                            'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                      {campaign.status}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-505 font-mono select-all">
                    Campaign ID: {campaign.id}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => fetchCampaignDetails(campaign.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all text-xs font-semibold cursor-pointer shadow-sm"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${detailsLoading ? 'animate-spin text-indigo-500' : ''}`} />
                    <span>Sync Logs</span>
                  </button>
                  <button
                    onClick={handleDeleteCampaign}
                    disabled={deleteLoading}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white transition-all text-xs font-bold cursor-pointer shadow-sm disabled:opacity-50"
                    title="Delete Campaign"
                  >
                    {deleteLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Delete Campaign</span>
                  </button>
                </div>
              </div>

              {/* Sub-grid: sidebar-stacked parameters and table data */}
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">

                {/* Parameters Stack (Sidebar style inside page) */}
                <div className="xl:col-span-1 space-y-5">
                  {/* Campaign configuration details */}
                  <div className="p-4 rounded-xl border border-slate-200 space-y-3.5 text-xs bg-slate-50/30">
                    <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                      Job Config
                    </h4>

                    <div className="space-y-3 text-slate-700">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Sender account</span>
                        <p className="font-medium text-slate-800 break-all">
                          {campaign.sender ? `${campaign.sender.name} (${campaign.sender.email})` : 'N/A'}
                        </p>
                      </div>

                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Start datetime</span>
                        <p className="font-mono text-slate-600">
                          {new Date(campaign.startTime).toLocaleString()}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                          <span className="text-[8px] text-slate-400 font-bold uppercase block">Interval</span>
                          <span className="font-bold text-slate-800 text-[11px]">{campaign.delayBetweenEmails / 1000}s</span>
                        </div>
                        <div className="p-2 rounded-lg bg-white border border-slate-200/80 text-center">
                          <span className="text-[8px] text-slate-400 font-bold uppercase block">Limit/hr</span>
                          <span className="font-bold text-slate-800 text-[11px]">{campaign.hourlyLimit}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delivery stats numbers */}
                  <div className="p-4 rounded-xl border border-slate-200 space-y-2 bg-slate-50/30 text-xs">
                    <h4 className="font-bold text-[10px] text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100 mb-2">
                      Delivery Metrics
                    </h4>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between p-2 rounded bg-white border border-slate-200">
                        <span className="text-slate-550 font-medium">Total Emails</span>
                        <span className="font-bold text-slate-900">{stats.total}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-amber-50/40 border border-amber-205 text-amber-700">
                        <span className="font-medium">Scheduled</span>
                        <span className="font-bold">{stats.scheduled}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-indigo-50/40 border border-indigo-200 text-indigo-700">
                        <span className="font-medium">Processing</span>
                        <span className="font-bold">{stats.processing}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-emerald-50/40 border border-emerald-202 text-emerald-700">
                        <span className="font-medium">Sent</span>
                        <span className="font-bold">{stats.sent}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-rose-50/40 border border-rose-202 text-rose-700">
                        <span className="font-medium">Failed</span>
                        <span className="font-bold">{stats.failed}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-purple-50/40 border border-purple-200 text-purple-700">
                        <span className="font-medium">Rate Limited</span>
                        <span className="font-bold">{stats.rateLimited}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-100 border border-slate-200 text-slate-600">
                        <span className="font-medium">Cancelled</span>
                        <span className="font-bold">{stats.cancelled}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recipients grids and inspectors layout */}
                <div className={`xl:col-span-3 grid grid-cols-1 ${selectedEmail ? '2xl:grid-cols-5' : ''} gap-5 items-start`}>

                  {/* Table area */}
                  <div className={`border border-slate-200 rounded-xl overflow-hidden bg-white ${selectedEmail ? '2xl:col-span-3' : 'w-full'}`}>
                    <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-550 uppercase tracking-wider">
                      👥 Campaign Recipients
                    </div>

                    {emails.length === 0 ? (
                      <div className="text-center py-20 text-slate-400 text-xs italic">
                        No recipients assigned to this job.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-[480px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                              <th className="py-2.5 px-3">Recipient</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emails.map((emailItem) => {
                              const isSelected = selectedEmail?.id === emailItem.id;
                              return (
                                <tr
                                  key={emailItem.id}
                                  onClick={() => setSelectedEmail(emailItem)}
                                  className={`border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer ${isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''
                                    }`}
                                >
                                  <td className="py-3 px-3 font-semibold text-slate-800 truncate max-w-[130px]" title={emailItem.recipient}>
                                    {emailItem.recipient}
                                  </td>
                                  <td className="py-3 px-3">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${emailItem.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-250' :
                                      emailItem.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-250' :
                                        emailItem.status === 'RATE_LIMITED' ? 'bg-purple-55 border border-purple-200 text-purple-700' :
                                          emailItem.status === 'PROCESSING' ? 'bg-indigo-55 border border-indigo-200 text-indigo-700 animate-pulse' :
                                            emailItem.status === 'CANCELLED' ? 'bg-slate-100 text-slate-655 border border-slate-200' :
                                              'bg-amber-55 text-amber-700 border border-amber-250'
                                      }`}>
                                      {emailItem.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => setSelectedEmail(emailItem)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.75 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded transition-all cursor-pointer text-[10px]"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>Inspect</span>
                                    </button>
                                    {(emailItem.status === 'SCHEDULED' || emailItem.status === 'RATE_LIMITED') && (
                                      <button
                                        onClick={() => handleCancelEmail(emailItem.id)}
                                        disabled={actionLoading === emailItem.id}
                                        className="px-1.5 py-0.75 bg-rose-55 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white font-bold rounded transition-all cursor-pointer text-[10px] disabled:opacity-50"
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

                  {/* Recipient Details Inspector */}
                  {selectedEmail && (
                    <div className="2xl:col-span-2 border border-slate-200 p-4.5 rounded-xl space-y-4 animate-in fade-in slide-in-from-right-3 duration-300 bg-white self-start">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-indigo-650" />
                          <h5 className="font-bold text-[10px] text-slate-555 uppercase tracking-wider">
                            Recipient Details
                          </h5>
                        </div>
                        <button
                          onClick={() => setSelectedEmail(null)}
                          className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Timeline */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider block">
                          Delivery State
                        </span>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-[9px] font-bold text-slate-450">
                          <div className="flex flex-col items-center">
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px]">✓</div>
                            <span className="mt-0.5">Created</span>
                          </div>
                          <span className="text-slate-300">→</span>

                          {selectedEmail.status === 'CANCELLED' ? (
                            <div className="flex flex-col items-center text-slate-400">
                              <div className="w-3.5 h-3.5 rounded-full bg-slate-300 text-white flex items-center justify-center text-[7px]">!</div>
                              <span className="mt-0.5">Cancelled</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex flex-col items-center text-emerald-600">
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px]">✓</div>
                                <span className="mt-0.5">Sched</span>
                              </div>
                              <span className="text-slate-300">→</span>

                              {selectedEmail.status === 'RATE_LIMITED' ? (
                                <>
                                  <div className="flex flex-col items-center text-purple-650">
                                    <div className="w-3.5 h-3.5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[7px]">!</div>
                                    <span className="mt-0.5">Limited</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className={`flex flex-col items-center ${selectedEmail.status === 'SENT' || selectedEmail.status === 'FAILED' ? 'text-emerald-600' : 'text-indigo-650'
                                    }`}>
                                    <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] ${selectedEmail.status === 'SENT' || selectedEmail.status === 'FAILED' ? 'bg-emerald-500 text-white' : 'bg-indigo-500 text-white animate-pulse'
                                      }`}>
                                      {selectedEmail.status === 'SENT' || selectedEmail.status === 'FAILED' ? '✓' : '•'}
                                    </div>
                                    <span className="mt-0.5">Process</span>
                                  </div>
                                  <span className="text-slate-300">→</span>

                                  {selectedEmail.status === 'SENT' ? (
                                    <div className="flex flex-col items-center text-emerald-600">
                                      <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[7px]">✓</div>
                                      <span className="mt-0.5">Sent</span>
                                    </div>
                                  ) : selectedEmail.status === 'FAILED' ? (
                                    <div className="flex flex-col items-center text-rose-600">
                                      <div className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white flex items-center justify-center text-[7px]">✗</div>
                                      <span className="mt-0.5">Failed</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center text-slate-400">
                                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300 text-slate-400 flex items-center justify-center text-[7px]">?</div>
                                      <span className="mt-0.5">Sent</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Inspector properties */}
                      <div className="p-3 rounded-lg bg-slate-55 border border-slate-200 space-y-2 text-[11px] text-slate-655 font-medium">
                        <div className="flex items-start gap-1">
                          <span className="font-semibold text-slate-450 w-14 shrink-0">To:</span>
                          <span className="text-slate-800 break-all select-all font-semibold">{selectedEmail.recipient}</span>
                        </div>
                        <div className="flex items-start gap-1">
                          <span className="font-semibold text-slate-455 w-14 shrink-0">Subject:</span>
                          <span className="text-slate-800">{selectedEmail.subject}</span>
                        </div>
                        <div className="flex items-start gap-1">
                          <span className="font-semibold text-slate-455 w-14 shrink-0">Scheduled:</span>
                          <span className="text-slate-600 font-mono">
                            {new Date(selectedEmail.scheduledAt).toLocaleString()}
                          </span>
                        </div>
                        {selectedEmail.sentAt && (
                          <div className="flex items-start gap-1">
                            <span className="font-semibold text-slate-455 w-14 shrink-0">Sent At:</span>
                            <span className="text-slate-600 font-mono">
                              {new Date(selectedEmail.sentAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {selectedEmail.errorMessage && (
                          <div className="pt-1.5 border-t border-slate-200 text-rose-650 space-y-1">
                            <span className="font-semibold uppercase text-[8px] tracking-wider text-rose-500 block">
                              ⚠ Delivery Error Details
                            </span>
                            <p className="bg-rose-50 p-2 rounded border border-rose-200 font-mono text-[10px] whitespace-pre-wrap select-all leading-relaxed">
                              {selectedEmail.errorMessage}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Body Sandbox content */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-455 font-bold uppercase tracking-wider block">
                          Message Preview
                        </span>
                        <div className="w-full h-36 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                          <iframe
                            title="Email Inspector Rich Preview"
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
                                      font-size: 11px;
                                      line-height: 1.4;
                                      color: #334155;
                                      background-color: #ffffff;
                                      margin: 4px;
                                    }
                                    a { color: #2563eb; }
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

                      {/* Ethereal log preview */}
                      {selectedEmail.status === 'SENT' && selectedEmail.previewUrl && (
                        <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-between gap-3 text-[10px]">
                          <div className="min-w-0">
                            <p className="font-bold text-indigo-700">Captured in Sandbox</p>
                            <p className="text-slate-500 truncate">Ethereal mail capture log is ready.</p>
                          </div>
                          <a
                            href={selectedEmail.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-white transition-all shadow-sm shrink-0 cursor-pointer"
                          >
                            <span>Ethereal Log</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
