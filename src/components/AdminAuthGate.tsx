import { useState } from 'react';
import type { FormEvent } from 'react';
import { Compass, KeyRound, Loader2, Lock, Mail } from 'lucide-react';
import { api, setAuthCredentials } from '../lib/api.ts';
import type { AuthStatusResponse } from '../lib/api.ts';
import type { AdminSessionUser } from '../types.ts';

interface AdminAuthGateProps {
  authStatus: AuthStatusResponse;
  onAuthenticated: (info: AdminSessionUser) => void;
}

export function AdminAuthGate({ authStatus, onAuthenticated }: AdminAuthGateProps) {
  const [mode, setMode] = useState<'credentials' | 'apikey'>('credentials');
  const [email, setEmail] = useState(authStatus.emailHint || 'admin@citycompanion.app');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid admin email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.setupAdmin(email.trim(), password);
      setAuthCredentials({ token: res.token });
      onAuthenticated({
        role: res.role,
        email: res.email,
        name: res.name,
        allowedCityIds: res.allowedCityIds ?? [],
        dbMode: res.dbMode,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'apikey') {
        if (!adminKey.trim()) {
          setError('Enter your ADMIN_SECRET key.');
          setSubmitting(false);
          return;
        }
        const res = await api.login({ adminKey: adminKey.trim() });
        setAuthCredentials({ token: res.token, adminKey: adminKey.trim() });
        onAuthenticated({
          role: res.role,
          email: res.email,
          name: res.name,
          allowedCityIds: res.allowedCityIds ?? [],
          dbMode: res.dbMode,
        });
      } else {
        if (!email.trim() || !password) {
          setError('Enter both email/username and password.');
          setSubmitting(false);
          return;
        }
        const res = await api.login({ email: email.trim(), password });
        setAuthCredentials({ token: res.token });
        onAuthenticated({
          role: res.role,
          email: res.email,
          name: res.name,
          allowedCityIds: res.allowedCityIds ?? [],
          dbMode: res.dbMode,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0284C7] text-white shadow-sm mb-3">
            <Compass className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            City Companion Admin
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {authStatus.dbMode === 'mongodb' ? 'MongoDB Connected' : 'Persistent Local Store'}
          </p>
        </div>

        <div className="surface-card p-6 sm:p-8">
          {authStatus.needsSetup ? (
            <form onSubmit={(e) => void handleSetup(e)} className="space-y-4">
              <div className="rounded-lg border border-sky-200 bg-[#E0F2FE]/60 p-3.5 text-xs text-sky-950 leading-relaxed">
                First-time setup: claim the administrator account to unlock city and collection management. This setup screen locks automatically once claimed.
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Admin Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    placeholder="admin@citycompanion.app"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Create Password (min 8 chars)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    placeholder="Enter strong password"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    placeholder="Confirm password"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Claiming Admin Account...' : 'Claim Admin Account & Enter'}
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              {authStatus.hasApiKeyConfigured && (
                <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('credentials');
                      setError('');
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      mode === 'credentials'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Email & Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('apikey');
                      setError('');
                    }}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      mode === 'apikey'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Admin API Key
                  </button>
                </div>
              )}

              <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
                {mode === 'credentials' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Email or Username
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                          placeholder="admin@citycompanion.app"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                          placeholder="Enter admin password"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      X-Admin-Key / ADMIN_SECRET
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="password"
                        required
                        value={adminKey}
                        onChange={(e) => setAdminKey(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 font-mono text-sm text-slate-900 focus:border-[#0284C7] focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                        placeholder="Paste ADMIN_SECRET"
                      />
                    </div>
                  </div>
                )}

                {error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0284C7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0369A1] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Signing In...' : 'Sign In to Dashboard'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
