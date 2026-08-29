import React, { useState, useEffect } from 'react';
import { sendersAPI } from '../services/api.js';
import { EmailSender } from '../types/index.js';
import { User, Trash2, Plus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface SendersManagerProps {
  onSendersUpdated?: (senders: EmailSender[]) => void;
}

export const SendersManager: React.FC<SendersManagerProps> = ({ onSendersUpdated }) => {
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchSenders = async () => {
    try {
      setLoading(true);
      const list = await sendersAPI.getSenders();
      setSenders(list);
      if (onSendersUpdated) {
        onSendersUpdated(list);
      }
    } catch (err) {
      console.error('Error fetching senders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSenders();
  }, []);

  const handleAddSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const created = await sendersAPI.createSender({
        name: newName.trim(),
        email: newEmail.trim(),
      });
      setNewName('');
      setNewEmail('');
      setSuccessMsg(`Sender "${created.name}" added successfully.`);
      await fetchSenders();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to add email sender.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSender = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sender? All linked campaigns will remain, but the sender details will be lost.')) {
      return;
    }

    try {
      await sendersAPI.deleteSender(id);
      await fetchSenders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete sender.');
    }
  };

  return (
    <div className="glass-panel p-6 rounded-xl space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-900 pb-4">
        <User className="w-5 h-5 text-indigo-400" />
        <h2 className="font-semibold text-base text-white">Email Senders</h2>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add Sender Form */}
      <form onSubmit={handleAddSender} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Sender Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none text-white transition-all"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Sender Email
            </label>
            <input
              type="email"
              required
              placeholder="e.g. john@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none text-white transition-all"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-650 hover:bg-indigo-700 text-xs font-bold text-white transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-650/10 active:scale-[0.98]"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>Add Sender</span>
        </button>
      </form>

      {/* Senders List */}
      <div className="space-y-2 pt-2 border-t border-slate-900/60">
        <h3 className="text-xs font-semibold text-slate-400 tracking-wide uppercase mb-3">
          Configured Senders
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-4 text-slate-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            Loading senders...
          </div>
        ) : senders.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-3 italic">
            No senders configured yet. Add one above!
          </p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {senders.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-900 bg-slate-950/20 hover:border-slate-800 hover:bg-slate-955/50 transition-all duration-200 text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-200">{s.name}</div>
                  <div className="text-slate-400 font-mono text-[11px] mt-0.5">{s.email}</div>
                </div>
                <button
                  onClick={() => handleDeleteSender(s.id)}
                  className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                  title="Remove Sender"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
