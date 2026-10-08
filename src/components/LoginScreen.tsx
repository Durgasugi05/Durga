import React, { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your email/username and password.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.session) {
        throw new Error(data.error || 'Invalid email/username or password.');
      }

      onLoginSuccess(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#03182B] flex flex-col justify-between">
      {/* Clean Top Bar: Exactly single-element wordmark, NO console/admin links */}
      <header className="w-full border-b border-[#03182B]/10 bg-[#F5F5F0]">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <span className="font-display text-xl font-extrabold tracking-tight text-[#03182B]">
            OPS FORTUNE
          </span>
          <span className="text-xs font-semibold tracking-wider text-[#03182B]/60 uppercase">
            Operations Management Arena
          </span>
        </div>
      </header>

      {/* Main Single Login Form Container */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 md:p-10 border border-[#03182B]/15 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#03182B] text-[#FF5A0A] flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#03182B] mb-1">
              OPS FORTUNE
            </h1>
            <p className="text-sm font-medium text-[#03182B]/65">
              Connect. Decode. Score.
            </p>
          </div>

          <div className="mb-6">
            <h2 className="font-display text-lg font-bold text-[#03182B] tracking-wide uppercase">
              SIGN IN
            </h2>
            <p className="text-xs text-[#03182B]/60 mt-0.5">
              Enter your assigned credentials to access your session.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-[#D7263D]/10 border border-[#D7263D]/30 text-[#D7263D] text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold tracking-wider text-[#03182B]/80 mb-2 uppercase">
                Email / Username
              </label>
              <input
                type="text"
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter email or username"
                className="w-full px-4 py-3.5 rounded-2xl bg-[#F5F5F0] border border-[#03182B]/20 text-[#03182B] text-sm font-medium focus:outline-none focus:border-[#D7263D]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-wider text-[#03182B]/80 mb-2 uppercase">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3.5 rounded-2xl bg-[#F5F5F0] border border-[#03182B]/20 text-[#03182B] text-sm font-medium focus:outline-none focus:border-[#D7263D]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-full bg-[#D7263D] hover:bg-[#FF5A0A] text-[#F5F5F0] font-display font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-2 cursor-pointer mt-4"
            >
              <span>{submitting ? 'Authenticating...' : 'SIGN IN'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="w-full py-4 px-6 border-t border-[#03182B]/10 text-center text-xs text-[#03182B]/60">
        OPS FORTUNE · Secure Operations Management Competition
      </footer>
    </div>
  );
};
