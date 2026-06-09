import { motion } from 'framer-motion';
import { Check, Zap, X } from 'lucide-react';

// ── Stripe config ─────────────────────────────────────────────────────────────
// 1. Create an account at https://stripe.com
// 2. Create a Product → Price (recurring monthly)
// 3. Add to .env:
//    VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
//    VITE_STRIPE_PRICE_ID=price_...
// 4. Add a /api/create-checkout endpoint to your server (see server/index.js)

const STRIPE_PRICE_ID = (import.meta as any).env?.VITE_STRIPE_PRICE_ID as string | undefined;
const stripeConfigured = !!STRIPE_PRICE_ID;

const FREE_FEATURES = [
  'Posture detection via webcam',
  'Browser TTS voice alerts',
  'XP system & achievements',
  'Analytics & focus sessions',
];

const PRO_FEATURES = [
  'Everything in Free',
  'AI-generated roasts (GPT-4o-mini)',
  'ElevenLabs emotional voices',
  'All 9 personalities unlocked',
  'Cloud sync across devices',
  'Priority support',
];

interface UpgradeProps {
  onClose: () => void;
  userEmail?: string;
}

export function Upgrade({ onClose, userEmail }: UpgradeProps) {

  async function handleUpgrade() {
    if (!stripeConfigured) {
      alert('Stripe not configured. Add VITE_STRIPE_PRICE_ID to .env');
      return;
    }

    // Call your server to create a Stripe Checkout session
    // The server returns a URL → open in browser (Electron shell)
    try {
      const serverUrl = (import.meta as any).env?.VITE_SERVER_URL || 'https://spine-guardian-production.up.railway.app';
      const res = await fetch(`${serverUrl}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: STRIPE_PRICE_ID,
          email: userEmail,
          successUrl: 'https://spineguardian.app/success',
          cancelUrl:  'https://spineguardian.app/cancel',
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        // Open Stripe checkout in the user's browser
        const api = (window as any).electronAPI;
        if (api) {
          // Electron — open in system browser
          window.open(data.url, '_blank');
        } else {
          window.location.href = data.url;
        }
      } else {
        alert(data.error || 'Could not start checkout');
      }
    } catch (err) {
      alert('Failed to connect to server. Try again.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>

      <motion.div
        initial={{ scale: 0.93, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.93, opacity: 0 }}
        className="relative w-full max-w-2xl mx-4 rounded-3xl p-8 flex flex-col gap-6"
        style={{ background: '#111118', border: '1px solid #1e1e2e' }}
      >
        {/* Close */}
        <button onClick={onClose} className="absolute top-5 right-5 p-1.5 rounded-xl"
          style={{ color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)' }}>
          <X size={14} />
        </button>

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-3"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
            <Zap size={11} /> Upgrade to Pro
          </div>
          <h2 className="text-2xl font-bold" style={{ color: '#e4e4f0' }}>
            Unlock the full experience
          </h2>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Get AI-powered roasts with real emotional voice — not just robotic TTS
          </p>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-2 gap-4">
          {/* Free */}
          <div className="rounded-2xl p-5 flex flex-col gap-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-sm font-bold" style={{ color: '#e4e4f0' }}>Free</p>
              <p className="text-2xl font-black mt-1" style={{ color: '#e4e4f0' }}>$0</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>forever</p>
            </div>
            <div className="flex flex-col gap-2">
              {FREE_FEATURES.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <Check size={13} style={{ color: '#34d399', flexShrink: 0, marginTop: 1 }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pro */}
          <div className="rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.4)' }}>
            {/* Shimmer top */}
            <div className="absolute top-0 left-4 right-4 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(124,58,237,0.6),transparent)' }} />

            <div>
              <p className="text-sm font-bold" style={{ color: '#a78bfa' }}>Pro</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-2xl font-black" style={{ color: '#e4e4f0' }}>$7</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>/month</p>
              </div>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>cancel anytime</p>
            </div>
            <div className="flex flex-col gap-2">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-start gap-2">
                  <Check size={13} style={{ color: '#a78bfa', flexShrink: 0, marginTop: 1 }} />
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>{f}</span>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleUpgrade}
              className="mt-auto flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
              style={{
                background: 'linear-gradient(135deg,rgba(124,58,237,0.6),rgba(109,40,217,0.5))',
                border: '1px solid rgba(124,58,237,0.6)',
                color: '#fff',
                boxShadow: '0 0 24px rgba(124,58,237,0.3)',
              }}
            >
              <Zap size={14} />
              Upgrade Now
            </motion.button>
          </div>
        </div>

        {!stripeConfigured && (
          <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Payments not configured yet — add VITE_STRIPE_PRICE_ID to .env
          </p>
        )}
      </motion.div>
    </div>
  );
}
