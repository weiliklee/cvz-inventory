import React, { useState } from 'react';
import { Sofa } from 'lucide-react';
import { supabase } from './supabaseClient.js';
import { COLORS } from './theme.js';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: `1px solid ${COLORS.border}`,
  backgroundColor: COLORS.bg,
  color: COLORS.ink,
  fontSize: '14px',
  fontFamily: "'IBM Plex Sans', sans-serif",
  outline: 'none',
};

function AuthShell({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: COLORS.bg }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-6">
          <Sofa size={22} color={COLORS.walnut} />
          <div className="font-display text-xl" style={{ color: COLORS.ink }}>CVZ Stock</div>
        </div>
        <div className="rounded-lg p-6" style={{ backgroundColor: COLORS.surface, border: `1px solid ${COLORS.border}` }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message);
    setLoading(false);
  }

  return (
    <AuthShell>
      <h1 className="font-display text-lg mb-1" style={{ color: COLORS.ink }}>Staff sign in</h1>
      <p className="font-body text-sm mb-5" style={{ color: COLORS.inkSoft }}>Sign in with the account you were invited with.</p>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-3.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            {error}
          </div>
        )}
        <label className="block mb-3.5">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>Email</span>
          <input type="email" required autoComplete="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>Password</span>
          <input type="password" required autoComplete="current-password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded text-sm font-medium font-body transition-opacity hover:opacity-80"
          style={{ backgroundColor: COLORS.walnut, color: '#fff', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="font-body text-xs mt-4" style={{ color: COLORS.inkFaint }}>
        Don't have an account? Ask an admin to invite you.
      </p>
    </AuthShell>
  );
}

export function SetPasswordForm({ onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onDone();
  }

  return (
    <AuthShell>
      <h1 className="font-display text-lg mb-1" style={{ color: COLORS.ink }}>Set your password</h1>
      <p className="font-body text-sm mb-5" style={{ color: COLORS.inkSoft }}>Choose a password to finish setting up your account.</p>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-3.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            {error}
          </div>
        )}
        <label className="block mb-3.5">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>New password</span>
          <input type="password" required autoComplete="new-password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>Confirm password</span>
          <input type="password" required autoComplete="new-password" style={inputStyle} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded text-sm font-medium font-body transition-opacity hover:opacity-80"
          style={{ backgroundColor: COLORS.walnut, color: '#fff', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Saving…' : 'Save password & continue'}
        </button>
      </form>
    </AuthShell>
  );
}
