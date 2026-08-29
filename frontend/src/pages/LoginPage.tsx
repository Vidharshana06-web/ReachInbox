import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Mail, Loader2, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, refreshUser, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loggingIn, setLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      setLoggingIn(true);
      localStorage.setItem('reachinbox_token', token);
      refreshUser().then(() => {
        navigate('/dashboard');
      });
    } else if (error) {
      if (error === 'auth_failed') {
        setErrorMsg('Google authentication failed. Please try again.');
      } else if (error === 'no_code') {
        setErrorMsg('Authorization code not provided by Google.');
      } else {
        setErrorMsg('An unexpected error occurred during login.');
      }
    }
  }, [searchParams, refreshUser, navigate]);

  useEffect(() => {
    // If already logged in, skip login page
    if (user && !loggingIn) {
      navigate('/dashboard');
    }
  }, [user, navigate, loggingIn]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md px-6">
        {/* Glassmorphic Panel Card */}
        <div className="glass-panel p-8 rounded-2xl shadow-2xl relative">
          <div className="flex flex-col items-center mb-8">
            {/* Branding Logo */}
            <div className="w-14 h-14 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4 ring-1 ring-white/10">
              <Mail className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              ReachInbox
            </h1>
            <p className="text-sm text-slate-400">
              Full-Stack Email Job Scheduler
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-xs leading-relaxed">
              {errorMsg}
            </div>
          )}

          {loggingIn ? (
            <div className="flex flex-col items-center justify-center py-6 text-slate-300">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-sm font-medium">Synchronizing with Google...</p>
              <p className="text-xs text-slate-500 mt-1">Authenticating session token</p>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={loginWithGoogle}
                className="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl bg-white text-slate-900 font-semibold text-sm transition-all hover:bg-slate-50 active:scale-[0.98] shadow-md shadow-white/5 cursor-pointer"
              >
                {/* SVG Google Icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5.04c1.67 0 3.19.57 4.38 1.69l3.27-3.27C17.67 1.58 15.02 1 12 1 7.37 1 3.4 3.67 1.48 7.57l3.79 2.94C6.18 7.07 8.83 5.04 12 5.04z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.42 3.57l3.74 2.9C21.96 18.91 23.49 15.93 23.49 12.27z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.27 14.77c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27L1.48 7.29C.53 9.18 0 11.28 0 13.5s.53 4.32 1.48 6.21l3.79-2.94z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.74-2.9c-1.16.78-2.65 1.25-4.22 1.25-3.17 0-5.82-2.03-6.73-4.94L1.48 16.44C3.4 20.33 7.37 23 12 23z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs text-slate-500">
                <span>Production Mode</span>
                <span className="flex items-center gap-1">
                  Vite + Tailwind <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
