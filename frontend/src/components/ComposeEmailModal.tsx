import React, { useState, useRef, useEffect } from 'react';
import { EmailSender } from '../types/index.js';
import { emailsAPI } from '../services/api.js';
import { X, Upload, Check, AlertTriangle, Loader2 } from 'lucide-react';

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  senders: EmailSender[];
  onCampaignScheduled: (stats: { totalScheduled: number; duplicatesRemoved: number }) => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  isOpen,
  onClose,
  senders,
  onCampaignScheduled,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedSenderId, setSelectedSenderId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  
  // File parsing stats
  const [parsedCount, setParsedCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [localDuplicateCount, setLocalDuplicateCount] = useState(0);
  const [fileName, setFileName] = useState('');

  // Scheduler parameters
  const [startTime, setStartTime] = useState('');
  const [delaySecs, setDelaySecs] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Set default values when modal opens
  useEffect(() => {
    if (isOpen) {
      if (senders.length > 0) {
        setSelectedSenderId(senders[0].id);
      }
      // Default start time: 5 minutes in the future, formatted for datetime-local input
      const date = new Date(Date.now() + 5 * 60 * 1000);
      const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
      const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
      setStartTime(localISOTime);
      
      // Reset fields
      setSubject('');
      setBody('');
      setRecipients([]);
      setParsedCount(0);
      setInvalidCount(0);
      setLocalDuplicateCount(0);
      setFileName('');
      setErrorMsg(null);
    }
  }, [isOpen, senders]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      // Extract all email lookalikes
      const allTokens = text.split(/[\s,;\n\r]+/);
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validEmailsSet = new Set<string>();
      let invalidCountLocal = 0;
      let rawEmailCount = 0;

      allTokens.forEach((token) => {
        const clean = token.trim();
        if (!clean) return;

        if (emailRegex.test(clean)) {
          rawEmailCount++;
          validEmailsSet.add(clean.toLowerCase());
        } else {
          invalidCountLocal++;
        }
      });

      const uniqueEmails = Array.from(validEmailsSet);
      setRecipients(uniqueEmails);
      setParsedCount(uniqueEmails.length);
      setLocalDuplicateCount(rawEmailCount - uniqueEmails.length);
      setInvalidCount(invalidCountLocal);
    };

    reader.onerror = () => {
      setErrorMsg('Failed to read lead file.');
    };

    reader.readAsText(file);
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedSenderId) {
      setErrorMsg('Please select an email sender.');
      return;
    }
    if (recipients.length === 0) {
      setErrorMsg('Please upload a file containing valid recipient email addresses.');
      return;
    }
    if (!startTime) {
      setErrorMsg('Please set a starting delivery time.');
      return;
    }

    setLoading(true);
    try {
      const result = await emailsAPI.schedule({
        senderId: selectedSenderId,
        subject,
        body,
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmails: delaySecs * 1000, // Convert to ms
        hourlyLimit,
      });

      onCampaignScheduled({
        totalScheduled: result.totalScheduled,
        duplicatesRemoved: result.duplicatesRemoved || 0,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || 'Failed to schedule email campaign.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-white">Compose & Schedule Campaign</h3>
            <p className="text-xs text-slate-400">Configure parameters to schedule email jobs</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleScheduleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Senders drop-down */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Select Sending Account
            </label>
            {senders.length === 0 ? (
              <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5 text-yellow-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>You must add at least one Email Sender on the dashboard before scheduling!</span>
              </div>
            ) : (
              <select
                required
                value={selectedSenderId}
                onChange={(e) => setSelectedSenderId(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none text-white transition-all"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Subject & Body */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Subject Line
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Catching up / ReachInbox Demo"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none text-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Body Content (HTML allowed)
              </label>
              <textarea
                required
                rows={5}
                placeholder="Hi there! Let's connect..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none font-mono text-white resize-y transition-all"
              />
            </div>
          </div>

          {/* File Upload Parser */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Upload Lead List (.csv or .txt)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group border border-dashed border-slate-800 bg-slate-950/40 hover:bg-slate-950/70 hover:border-indigo-500/40 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".csv,.txt"
                className="hidden"
              />
              <div className="p-3 rounded-full bg-slate-900 border border-slate-800 group-hover:border-indigo-500/20 group-hover:bg-indigo-500/5 transition-colors">
                <Upload className="w-5 h-5 text-slate-400 group-hover:text-indigo-400" />
              </div>
              <span className="text-xs font-medium text-slate-300">
                {fileName ? `Selected: ${fileName}` : 'Click to select CSV or TXT file'}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">
                Supports name, email headers or raw values. Duplicates are removed automatically.
              </span>
            </div>

            {parsedCount > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/60 text-xs gap-2">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Check className="w-4 h-4" />
                  {parsedCount} unique emails detected
                </span>
                <div className="flex gap-3 text-slate-400">
                  {localDuplicateCount > 0 && (
                    <span className="text-indigo-400 font-medium">
                      {localDuplicateCount} duplicate{localDuplicateCount > 1 ? 's' : ''} filtered
                    </span>
                  )}
                  {invalidCount > 0 && (
                    <span>
                      {invalidCount} invalid row{invalidCount > 1 ? 's' : ''} skipped
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Scheduling controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800/60">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Delivery Start Time
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none text-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Delay Between Emails (seconds)
              </label>
              <input
                type="number"
                min={1}
                required
                value={delaySecs}
                onChange={(e) => setDelaySecs(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none text-white transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Hourly Sending Limit
              </label>
              <input
                type="number"
                min={1}
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 text-sm rounded-lg premium-input focus:outline-none text-white transition-all"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || senders.length === 0 || recipients.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scheduling Campaign...</span>
                </>
              ) : (
                <span>Schedule Campaign</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
