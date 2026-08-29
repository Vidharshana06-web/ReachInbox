import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { authAPI, slackAPI } from '../services/api.js';
import { 
  Settings as SettingsIcon, 
  CheckCircle2, 
  AlertTriangle, 
  Slack,
  Save,
  Loader2,
  Trash2
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [updating, setUpdating] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Slack Connection state
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackChannel, setSlackChannel] = useState<string | null>(null);
  const [slackLoading, setSlackLoading] = useState(true);

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
    fetchSlackStatus();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setUpdating(true);
    setNotification(null);
    try {
      await authAPI.updateProfile({
        name: name.trim(),
        avatar: avatar.trim() || ''
      });
      await refreshUser();
      setNotification({ message: 'Profile updated successfully!', type: 'success' });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to update profile.';
      setNotification({ message: errorMsg, type: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  const handleSlackConnect = () => {
    const token = localStorage.getItem('reachinbox_token');
    window.location.href = `${slackAPI.getConnectUrl()}?token=${encodeURIComponent(token || '')}`;
  };

  const handleSlackDisconnect = async () => {
    if (!window.confirm('Disconnect Slack alerts integration?')) return;
    setSlackLoading(true);
    try {
      await slackAPI.disconnect();
      setSlackConnected(false);
      setSlackChannel(null);
      setNotification({ message: 'Slack alerts integration disconnected.', type: 'info' });
    } catch (err) {
      setNotification({ message: 'Failed to disconnect Slack.', type: 'error' });
    } finally {
      setSlackLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Panel */}
      <div className="space-y-0.5">
        <h2 className="text-xl font-bold text-slate-900">Profile & Settings</h2>
        <p className="text-xs text-slate-500">
          Manage your personal details, update profile picture avatar, and configure Slack alerting connections.
        </p>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl text-xs font-semibold leading-relaxed border ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' :
          notification.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' :
          'bg-blue-50 border-blue-100 text-blue-800'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Profile Card details */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-blue-600" />
              <span>Personal Profile</span>
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Google Account Email (Non-editable)
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none cursor-not-allowed select-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  required
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Avatar Image URL
                </label>
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="Paste image URL (optional)"
                  className="w-full bg-white border border-slate-200 text-slate-900 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-colors"
                />
              </div>
            </form>
          </div>

          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end">
            <button
              onClick={handleUpdateProfile}
              disabled={updating || !name.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all text-xs font-semibold cursor-pointer shadow-sm disabled:opacity-50"
            >
              {updating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* Slack Card Details */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="p-6 space-y-6">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Slack className="w-4 h-4 text-emerald-600" />
              <span>Slack Integrations</span>
            </h3>

            <div className="space-y-4">
              <p className="text-xs text-slate-500 leading-normal">
                Receive real-time Slack channel warnings immediately when any campaign sender hits their configured hourly limit.
              </p>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Connection Status</span>
                  {slackLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  ) : slackConnected ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                      <AlertTriangle className="w-3 h-3" />
                      Disconnected
                    </span>
                  )}
                </div>

                {slackConnected && slackChannel && (
                  <div className="mt-3 pt-3 border-t border-slate-200/50 flex items-center justify-between text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Target Channel</span>
                    <span className="font-mono text-[11px] font-semibold text-slate-700">#{slackChannel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-end">
            {slackConnected ? (
              <button
                onClick={handleSlackDisconnect}
                disabled={slackLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-600 text-rose-650 hover:text-white transition-all text-xs font-semibold cursor-pointer shadow-sm disabled:opacity-50"
              >
                {slackLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Disconnect Slack</span>
              </button>
            ) : (
              <button
                onClick={handleSlackConnect}
                disabled={slackLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all text-xs font-semibold cursor-pointer shadow-sm disabled:opacity-50"
              >
                {slackLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Slack className="w-3.5 h-3.5" />
                )}
                <span>Connect Slack Alerts</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
