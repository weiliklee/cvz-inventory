import React, { useState } from 'react';
import { Sofa } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from './supabaseClient.js';
import { COLORS } from './theme.js';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: `1px solid ${COLORS.border}`,
  backgroundColor: COLORS.bg,
  color: COLORS.ink,
  fontSize: '0.875rem',
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
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === 'Invalid login credentials' ? t('auth.signIn.incorrectCredentials') : error.message);
    setLoading(false);
  }

  return (
    <AuthShell>
      <h1 className="font-display text-lg mb-1" style={{ color: COLORS.ink }}>{t('auth.signIn.title')}</h1>
      <p className="font-body text-sm mb-5" style={{ color: COLORS.inkSoft }}>{t('auth.signIn.subtitle')}</p>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-3.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            {error}
          </div>
        )}
        <label className="block mb-3.5">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>{t('auth.signIn.email')}</span>
          <input type="email" required autoComplete="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>{t('auth.signIn.password')}</span>
          <input type="password" required autoComplete="current-password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded text-sm font-medium font-body transition-opacity hover:opacity-80"
          style={{ backgroundColor: COLORS.walnut, color: '#fff', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t('auth.signIn.submitting') : t('auth.signIn.submit')}
        </button>
      </form>
      <p className="font-body text-xs mt-4" style={{ color: COLORS.inkFaint }}>
        {t('auth.signIn.noAccount')}
      </p>
    </AuthShell>
  );
}

export function SetPasswordForm({ onDone }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { setError(t('auth.setPassword.errors.tooShort')); return; }
    if (password !== confirm) { setError(t('auth.setPassword.errors.mismatch')); return; }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    onDone();
  }

  return (
    <AuthShell>
      <h1 className="font-display text-lg mb-1" style={{ color: COLORS.ink }}>{t('auth.setPassword.title')}</h1>
      <p className="font-body text-sm mb-5" style={{ color: COLORS.inkSoft }}>{t('auth.setPassword.subtitle')}</p>
      <form onSubmit={handleSubmit} noValidate>
        {error && (
          <div className="mb-3.5 px-3 py-2 rounded text-xs font-body font-medium" style={{ backgroundColor: COLORS.rustBg, color: COLORS.rust }}>
            {error}
          </div>
        )}
        <label className="block mb-3.5">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>{t('auth.setPassword.newPassword')}</span>
          <input type="password" required autoComplete="new-password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <label className="block mb-4">
          <span className="block text-xs font-medium font-body mb-1.5" style={{ color: COLORS.inkSoft }}>{t('auth.setPassword.confirmPassword')}</span>
          <input type="password" required autoComplete="new-password" style={inputStyle} value={confirm} onChange={e => setConfirm(e.target.value)} />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded text-sm font-medium font-body transition-opacity hover:opacity-80"
          style={{ backgroundColor: COLORS.walnut, color: '#fff', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t('auth.setPassword.submitting') : t('auth.setPassword.submit')}
        </button>
      </form>
    </AuthShell>
  );
}
