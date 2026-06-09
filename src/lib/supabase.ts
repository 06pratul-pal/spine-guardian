import { createClient } from '@supabase/supabase-js';

// ── Supabase config ───────────────────────────────────────────────────────────
// 1. Create a free project at https://supabase.com
// 2. Go to Project Settings → API
// 3. Copy your Project URL and anon/public key
// 4. Add them to your .env file:
//    VITE_SUPABASE_URL=https://xxxx.supabase.co
//    VITE_SUPABASE_ANON_KEY=eyJhbGci...

const SUPABASE_URL  = (import.meta as any).env?.VITE_SUPABASE_URL  as string | undefined;
const SUPABASE_ANON = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(SUPABASE_URL && SUPABASE_ANON);

export const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL!, SUPABASE_ANON!)
  : null;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  plan: 'free' | 'pro';
  createdAt: string;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
export async function signUp(email: string, password: string) {
  if (!supabase) return { error: 'Supabase not configured' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { data, error: error?.message };
}

export async function signIn(email: string, password: string) {
  if (!supabase) return { error: 'Supabase not configured' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error: error?.message };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch plan from profiles table
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, created_at')
    .eq('id', user.id)
    .single();

  return {
    id:        user.id,
    email:     user.email ?? '',
    plan:      profile?.plan ?? 'free',
    createdAt: profile?.created_at ?? user.created_at,
  };
}

export async function getUserPlan(): Promise<'free' | 'pro'> {
  const user = await getCurrentUser();
  return user?.plan ?? 'free';
}
