import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Mail, LogOut, ExternalLink, Loader2 } from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        <div className="flex flex-col items-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-sm font-medium">Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Premium Header Nav */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-white tracking-tight">ReachInbox</span>
            </Link>
            <span className="hidden sm:inline-block h-4 w-px bg-slate-800" />
            <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              Scheduler Dashboard
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Bull Board Quicklink */}
            <a
              href="http://localhost:5000/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/50 hover:bg-slate-900 transition-colors text-xs font-medium text-slate-300 cursor-pointer"
            >
              <span>Queue Board</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Profile Avatar & Metadata */}
            <div className="flex items-center gap-3 pl-2 border-l border-slate-900">
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-white leading-tight">
                  {user.name}
                </div>
                <div className="text-xs text-slate-400">
                  {user.email}
                </div>
              </div>
              
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-9 h-9 rounded-full ring-2 ring-indigo-500/20"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center font-bold text-sm text-indigo-300 ring-2 ring-indigo-500/20">
                  {user.name.charAt(0)}
                </div>
              )}

              <button
                onClick={logout}
                title="Sign Out"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};
