import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Mail, LogOut, Loader2, ExternalLink, LayoutDashboard, Layers, Menu, Zap, Settings } from 'lucide-react';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Collapsible sidebar state - defaults to false (hidden)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-600 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-semibold">Validating session credentials...</p>
      </div>
    );
  }

  if (!user) return null;

  const isDashboardActive = location.pathname === '/dashboard' || location.pathname === '/';
  const isJobsActive = location.pathname.startsWith('/jobs');
  const isQueuesActive = location.pathname.startsWith('/queues');
  const isSettingsActive = location.pathname.startsWith('/settings');

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Fixed Top Header Navbar */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-6 fixed top-0 left-0 right-0 z-40">
        <div className="flex items-center gap-3">
          {/* Menu Toggle Trigger (mobile only) */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Toggle Sidebar Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Premium Logo Branding */}
          <div className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-650 flex items-center justify-center text-white shadow-md shadow-blue-500/10 shrink-0">
              <Zap className="w-4.5 h-4.5 animate-pulse" />
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900">
              ReachInbox <span className="font-light text-slate-500">Scheduler</span>
            </span>
          </div>
        </div>

        {/* User Card Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200/60 p-1.5 pr-3 rounded-lg text-xs">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
              alt="User Profile"
              className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 select-none pointer-events-none"
            />
            <div className="text-left leading-tight">
              <p className="font-semibold text-slate-800">{user.name}</p>
              <p className="text-[9px] text-slate-500 font-mono select-all">{user.email}</p>
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Log Out Profile"
            className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border border-transparent hover:border-rose-100"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Layout Body wrapper */}
      <div className="flex-1 flex pt-16 relative overflow-hidden">
        
        {/* Permanent Sidebar (Desktop) / Collapsible Sidebar Drawer (Mobile) */}
        <aside
          className={`fixed md:static top-16 bottom-0 left-0 z-35 w-64 bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out transform md:translate-x-0 md:ml-0 ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Navigation Items */}
          <nav className="flex-1 p-4 space-y-1.5">
            <Link
              to="/dashboard"
              onClick={() => setIsSidebarOpen(false)} // close drawer on mobile when clicking links
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isDashboardActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/jobs"
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isJobsActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Jobs</span>
            </Link>

            <Link
              to="/queues"
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isQueuesActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>Queue Board</span>
            </Link>

            <Link
              to="/settings"
              onClick={() => setIsSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isSettingsActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </Link>
          </nav>

          {/* Profile card fallback for mobile viewports */}
          <div className="p-4 border-t border-slate-200 flex sm:hidden items-center gap-2.5 bg-slate-50/50">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
              alt="User Details"
              className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-mono truncate">{user.email}</p>
            </div>
          </div>
        </aside>

        {/* Semi-transparent backdrop overlay for mobile screens when sidebar drawer is open */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-20 md:hidden"
          />
        )}

        {/* Content Pane - automatically shifts left margin on desktop when sidebar opens */}
        <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
