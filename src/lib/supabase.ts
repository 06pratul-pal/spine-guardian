import { createClient } from '@supabase/supabase-js';

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

// Cloud sync data shape — stored in profiles table
export interface CloudSyncData {
  total_xp: number;
  streak_days: number;
  last_active_date: string;
  settings_json: string; // JSON string of AppSettings
  unlocked_achievements: string; // JSON string of achievement IDs array
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

// ── Cloud sync helpers ────────────────────────────────────────────────────────

/** Push local data to Supabase — called after XP changes or session ends */
export async function pushCloudSync(data: CloudSyncData): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('profiles')
    .update({
      total_xp:               data.total_xp,
      streak_days:            data.streak_days,
      last_active_date:       data.last_active_date,
      settings_json:          data.settings_json,
      unlocked_achievements:  data.unlocked_achievements,
      updated_at:             new Date().toISOString(),
    })
    .eq('id', user.id);
}

/** Pull cloud data and merge with local — called on app startup after sign in */
export async function pullCloudSync(): Promise<CloudSyncData | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('total_xp, streak_days, last_active_date, settings_json, unlocked_achievements')
    .eq('id', user.id)
    .single();

  if (!profile || profile.total_xp === null) return null;

  return {
    total_xp:              profile.total_xp ?? 0,
    streak_days:           profile.streak_days ?? 0,
    last_active_date:      profile.last_active_date ?? '',
    settings_json:         profile.settings_json ?? '{}',
    unlocked_achievements: profile.unlocked_achievements ?? '[]',
  };
}
