import React, { useEffect, useState } from 'react';
import { queuesAPI } from '../services/api.js';
import { 
  RefreshCw, 
  Trash2, 
  RotateCcw, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity, 
  Inbox,
  ExternalLink
} from 'lucide-react';

interface JobInfo {
  id: string;
  name: string;
  state: 'active' | 'waiting' | 'delayed' | 'failed' | 'completed' | 'paused';
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  failedReason?: string;
  delay: number;
  emailInfo?: {
    recipient: string;
    subject: string;
    status: string;
    campaign?: {
      subject: string;
    };
    sender?: {
      name: string;
      email: string;
    };
  };
}

export const QueueBoard: React.FC = () => {
  const [counts, setCounts] = useState<any>({
    active: 0,
    waiting: 0,
    delayed: 0,
    failed: 0,
    completed: 0,
  });
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const data = await queuesAPI.getQueueStatus();
      setCounts(data.counts);
      setJobs(data.jobs);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load queue details:', err);
      setError('Failed to load live queue details. Make sure your backend server and Redis are running.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);
    // Poll queue status every 10 seconds for real-time visual updates
    const timer = setInterval(() => {
      fetchStatus(false);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleRetryJob = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await queuesAPI.retryJob(jobId);
      await fetchStatus(false);
    } catch (err) {
      alert('Failed to retry job.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveJob = async (jobId: string) => {
    if (!confirm('Are you sure you want to remove this job from the queue? This will cancel any pending retry attempts.')) return;
    setActionLoading(jobId);
    try {
      await queuesAPI.removeJob(jobId);
      await fetchStatus(false);
    } catch (err) {
      alert('Failed to remove job.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCleanQueue = async (status: 'completed' | 'failed') => {
    if (!confirm(`Are you sure you want to clean all ${status} jobs?`)) return;
    setLoading(true);
    try {
      await queuesAPI.cleanQueue(status);
      await fetchStatus(false);
    } catch (err) {
      alert('Failed to clean queue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-slate-900">Queue Monitor Board</h2>
          <p className="text-xs text-slate-500">
            Inspect and manage real-time BullMQ background jobs. Note: Completed jobs are automatically cleared from the queue to optimize Redis memory; check the Dashboard or Jobs explorer page for cumulative email delivery statistics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStatus(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all text-xs font-semibold cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Force Sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs text-rose-700 font-semibold leading-relaxed">
          {error}
        </div>
      )}

      {/* Grid of job states counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {/* Active Card */}
        <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-500 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            Active
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2">{counts.active || 0}</span>
        </div>

        {/* Waiting Card */}
        <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-500 flex items-center gap-1.5">
            <Inbox className="w-3.5 h-3.5" />
            Waiting
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2">{counts.waiting || 0}</span>
        </div>

        {/* Delayed Card */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 animate-bounce" />
            Delayed (Retries)
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2">{counts.delayed || 0}</span>
        </div>

        {/* Failed Card */}
        <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col justify-between min-h-[90px]">
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Failed
          </span>
          <span className="text-2xl font-black text-slate-900 mt-2">{counts.failed || 0}</span>
        </div>

        {/* Completed Card */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col justify-between min-h-[90px]">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </span>
            <span className="text-[8px] text-slate-400 block leading-tight font-medium">
              *Auto-cleared from Redis on completion
            </span>
          </div>
          <span className="text-2xl font-black text-slate-900 mt-2">{counts.completed || 0}</span>
        </div>
      </div>

      {/* Main Jobs Section */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">Queue Jobs Log</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCleanQueue('completed')}
              disabled={loading || counts.completed === 0}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-650 hover:text-slate-800 transition-all text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Clean Completed
            </button>
            <button
              onClick={() => handleCleanQueue('failed')}
              disabled={loading || counts.failed === 0}
              className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/30 hover:bg-rose-550/10 text-rose-650 hover:text-rose-700 transition-all text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Clean Failed
            </button>
          </div>
        </div>

        {/* Table/List View */}
        {loading && jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-450 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs font-semibold">Syncing background jobs queue...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2 text-center p-4">
            <Inbox className="w-8 h-8 text-slate-300" />
            <p className="text-xs font-semibold">No active background jobs in the queue.</p>
            <p className="text-[10px] text-slate-550 max-w-sm leading-normal">
              When you schedule a campaign, background BullMQ jobs will be registered here and processed.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/20 text-[10px] uppercase text-slate-400 font-extrabold tracking-wider">
                  <th className="py-3.5 px-4 font-bold">Job & State</th>
                  <th className="py-3.5 px-4 font-bold">Target Recipient / Subject</th>
                  <th className="py-3.5 px-4 font-bold">Queue Stats</th>
                  <th className="py-3.5 px-4 font-bold">Error/Fail Reason</th>
                  <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {jobs.map((job) => {
                  const stateBadgeStyles = 
                    job.state === 'active' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    job.state === 'waiting' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    job.state === 'delayed' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    job.state === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' :
                    'bg-slate-100 text-slate-600 border-slate-200';

                  return (
                    <tr key={job.id} className="hover:bg-slate-50/40 transition-colors">
                      {/* Job name and state */}
                      <td className="py-3.5 px-4 min-w-[150px]">
                        <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={job.id}>
                          ID: {job.id.substring(0, 18)}...
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className={`inline-block px-1.5 py-0.25 rounded text-[8px] font-extrabold border ${stateBadgeStyles} uppercase tracking-wider`}>
                            {job.state}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono font-semibold">
                            {job.name}
                          </span>
                        </div>
                      </td>

                      {/* Recipient details */}
                      <td className="py-3.5 px-4 min-w-[220px]">
                        {job.emailInfo ? (
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 truncate max-w-[220px]" title={job.emailInfo.recipient}>
                              {job.emailInfo.recipient}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate max-w-[220px]" title={job.emailInfo.subject}>
                              Subj: {job.emailInfo.subject}
                            </p>
                            {job.emailInfo.campaign && (
                              <p className="text-[9px] text-indigo-650 font-semibold truncate max-w-[220px]">
                                Campaign: {job.emailInfo.campaign.subject}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No associated database record</span>
                        )}
                      </td>

                      {/* Queue Stats */}
                      <td className="py-3.5 px-4 min-w-[150px] space-y-0.5">
                        <div className="text-[10px] font-medium text-slate-605">
                          Attempts: <span className="font-bold">{job.attemptsMade}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Added: {new Date(job.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                        {job.delay > 0 && (
                          <div className="text-[9px] text-indigo-655 font-semibold">
                            Delay: {(job.delay / 1000).toFixed(0)}s
                          </div>
                        )}
                      </td>

                      {/* Failure / Error logs */}
                      <td className="py-3.5 px-4 max-w-[200px] min-w-[150px]">
                        {job.state === 'failed' && job.failedReason ? (
                          <p className="text-[10px] text-rose-600 leading-relaxed font-semibold line-clamp-2 bg-rose-50/40 p-1.5 rounded-lg border border-rose-100" title={job.failedReason}>
                            {job.failedReason}
                          </p>
                        ) : (
                          <span className="text-slate-350">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right min-w-[100px]">
                        <div className="flex items-center justify-end gap-1.5">
                          {job.state === 'failed' && (
                            <button
                              onClick={() => handleRetryJob(job.id)}
                              disabled={actionLoading !== null}
                              className="p-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-200/50 cursor-pointer disabled:opacity-50"
                              title="Retry Failed Job"
                            >
                              {actionLoading === job.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}

                          {['failed', 'waiting', 'delayed'].includes(job.state) && (
                            <button
                              onClick={() => handleRemoveJob(job.id)}
                              disabled={actionLoading !== null}
                              className="p-1.5 rounded bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-200/50 cursor-pointer disabled:opacity-50"
                              title="Cancel / Remove Job"
                            >
                              {actionLoading === job.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
