import React, { useState, useEffect } from 'react';
import { emailsAPI } from '../services/api.js';
import { ScheduledEmail } from '../types/index.js';
import { X, ExternalLink, Loader2, AlertCircle, Mail, Calendar, User, CornerDownRight } from 'lucide-react';

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  emailId: string | null;
}

export const EmailPreviewModal: React.FC<EmailPreviewModalProps> = ({
  isOpen,
  onClose,
  emailId,
}) => {
  const [email, setEmail] = useState<ScheduledEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !emailId) {
      setEmail(null);
      setError(null);
      return;
    }

    const fetchEmailDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await emailsAPI.getEmailById(emailId);
        setEmail(data);
      } catch (err: any) {
        console.error('Failed to load email preview:', err);
        setError(err.response?.data?.error || 'Unable to load email preview.');
      } finally {
        setLoading(false);
      }
    };

    fetchEmailDetails();
  }, [isOpen, emailId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Email Preview</h3>
              <p className="text-xs text-slate-500 font-medium">Verify recipient delivery status and payload</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-semibold">Retrieving email content from database...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Preview Error</p>
                <p className="text-slate-500">{error}</p>
              </div>
            </div>
          ) : email ? (
            <div className="space-y-4">
              {/* Meta information card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-500 w-16 shrink-0 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> To:
                  </span>
                  <span className="text-slate-800 font-semibold select-all">{email.recipient}</span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-500 w-16 shrink-0 flex items-center gap-1">
                    <CornerDownRight className="w-3.5 h-3.5" /> From:
                  </span>
                  <span className="text-slate-650 font-mono">
                    {email.sender ? `${email.sender.name} <${email.sender.email}>` : 'N/A'}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-500 w-16 shrink-0 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> Date:
                  </span>
                  <span className="text-slate-600">
                    {email.sentAt 
                      ? `Sent at ${new Date(email.sentAt).toLocaleString()}` 
                      : `Scheduled for ${new Date(email.scheduledAt).toLocaleString()}`}
                  </span>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                  <span className="font-semibold text-slate-500 w-16 shrink-0">Status:</span>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    email.status === 'SENT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    email.status === 'FAILED' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    email.status === 'RATE_LIMITED' ? 'bg-purple-55 border border-purple-200 text-purple-700' :
                    'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {email.status}
                  </span>
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Subject Line
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-medium">
                  {email.subject}
                </div>
              </div>

              {/* HTML/Plain Body Preview iframe */}
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Message Content (Rich Text Sandbox)
                </label>
                <div className="w-full h-64 border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <iframe
                    title="Email Rich Preview"
                    sandbox="allow-popups"
                    className="w-full h-full bg-white text-slate-800 p-2 border-none"
                    srcDoc={`
                      <!DOCTYPE html>
                      <html>
                        <head>
                          <meta charset="utf-8">
                          <style>
                            body {
                              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                              font-size: 14px;
                              line-height: 1.6;
                              color: #1e293b;
                              background-color: #ffffff;
                              margin: 12px;
                            }
                            a {
                              color: #4f46e5;
                            }
                          </style>
                        </head>
                        <body>
                          ${email.body}
                        </body>
                      </html>
                    `}
                  />
                </div>
              </div>

              {/* SMTP Preview Link */}
              {email.status === 'SENT' && email.previewUrl && (
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-between gap-4">
                  <div className="text-xs">
                    <p className="font-semibold text-indigo-700">SMTP Sandbox Preview Available</p>
                    <p className="text-slate-500 text-[11px] mt-0.5">This email was captured in Ethereal's inbox logs.</p>
                  </div>
                  <a
                    href={email.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-all cursor-pointer whitespace-nowrap shadow-sm"
                  >
                    <span>View Inbox Log</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs">
              No preview data available for this email ID.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end p-5 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
