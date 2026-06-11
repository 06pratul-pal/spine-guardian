import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Loader, Eye, EyeOff } from 'lucide-react';
import { signIn, signUp, supabaseConfigured } from '../lib/supabase';

type Mode = 'signin' | 'signup';

interface AuthProps {
  onAuth: () => void;
  onSkip: () => void;
}

// Make Supabase error messages user-friendly
function friendlyError(msg: string): string {
  if (!msg) return 'Something went wrong. Please try again.';
  if (msg.includes('Invalid login credentials'))
    return 'Wrong email or password. Please check and try again.';
  if (msg.includes('Email not confirmed'))
    return 'Please confirm your email first. Check your inbox.';
  if (msg.includes('User already registered'))
    return 'An account with this email already exists. Try signing in instead.';
  if (msg.includes('Password should be'))
    return 'Password must be at least 8 characters.';
  if (msg.includes('Unable to validate email'))
    return 'Please enter a valid email address.';
  if (msg.includes('Failed to fetch') || msg.includes('fetch'))
    return 'Connection failed. Check your internet and try again.';
  return msg;
}

export function Auth({ onAuth, onSkip }: AuthProps) {
  const [mode,      setMode]      = useState<Mode>('signin');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const result = mode === 'signup'
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password);

    setLoading(false);

    if (result.error) {
      setError(friendlyError(result.error));
    } else if (mode === 'signup') {
      setSuccess('Account created! Check your email to confirm, then sign in.');
      setMode('signin');
    } else {
      onAuth();
    }
  }

  if (!supabaseConfigured) {
    // Supabase not set up yet — show a notice but allow skipping
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-8"
        style={{ background: '#0a0a0f' }}>
        <div className="text-5xl">🦴</div>
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2" style={{ color: '#e4e4f0' }}>
            Spine Guardian AI
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            User accounts not configured yet. Add{' '}
            <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: '#a78bfa' }}>
              VITE_SUPABASE_URL
            </code>{' '}
            and{' '}
            <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: '#a78bfa' }}>
              VITE_SUPABASE_ANON_KEY
            </code>{' '}
            to your .env to enable sign-in.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onSkip}
          className="px-8 py-3 rounded-2xl text-sm font-bold"
          style={{
            background: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.4)',
            color: '#a78bfa',
          }}
        >
          Continue without account
        </motion.button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center px-8"
      style={{ background: '#0a0a0f' }}>

      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-16 h-16 rounded-3xl text-4xl"
          style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
          🦴
        </div>
        <h1 className="text-xl font-bold" style={{ color: '#e4e4f0' }}>Spine Guardian AI</h1>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-3xl p-7 flex flex-col gap-5"
        style={{ background: '#111118', border: '1px solid #1e1e2e' }}>

        {/* Mode tabs */}
        <div className="flex rounded-xl p-1 gap-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
          {(['signin', 'signup'] as Mode[]).map((m) => (
            <motion.button
              key={m}
              onClick={() => { setMode(m); setError(''); setSuccess(''); }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold capitalize"
              style={{
                background: mode === m ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: mode === m ? '#a78bfa' : 'rgba(255,255,255,0.4)',
              }}
            >
              {m === 'signin' ? 'Sign In' : 'Sign Up'}
            </motion.button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Email</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Mail size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: '#e4e4f0' }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>Password</label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Lock size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: '#e4e4f0' }}
              />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ color: 'rgba(255,255,255,0.3)' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Error / success */}
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </motion.p>
            )}
            {success && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs px-3 py-2 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                {success}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: loading ? 1 : 1.02 }}
            whileTap={{ scale: loading ? 1 : 0.97 }}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
            style={{
              background: loading ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.22)',
              border: `1px solid ${loading ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.45)'}`,
              color: loading ? 'rgba(255,255,255,0.3)' : '#a78bfa',
            }}
          >
            {loading ? <Loader size={15} className="animate-spin" /> : null}
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </motion.button>
        </form>
      </div>

      {/* Skip */}
      <button
        onClick={onSkip}
        className="mt-5 text-xs"
        style={{ color: 'rgba(255,255,255,0.25)' }}
      >
        Continue without account →
      </button>
    </div>
  );
}
