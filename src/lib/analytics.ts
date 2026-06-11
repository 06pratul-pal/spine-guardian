import { supabase, supabaseConfigured } from './supabase';

// ── Event types ───────────────────────────────────────────────────────────────
export type AnalyticsEvent =
  | 'app_opened'
  | 'session_started'          // monitoring session started
  | 'session_ended'            // monitoring session ended
  | 'focus_session_started'    // focus/pomodoro started
  | 'focus_session_completed'  // focus session completed
  | 'alert_fired'              // voice alert triggered
  | 'violation_shown'          // violation overlay shown
  | 'personality_changed'      // user switched personality
  | 'calibration_completed'    // user calibrated posture
  | 'achievement_unlocked'     // achievement earned
  | 'upgrade_modal_opened'     // user clicked upgrade
  | 'settings_changed'         // user changed a setting
  | 'page_viewed';             // user navigated to a page

// ── Queue for offline events ──────────────────────────────────────────────────
// If Supabase is unavailable, queue events and flush when back online
const eventQueue: Array<{ event: AnalyticsEvent; properties: Record<string, unknown> }> = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ── Main track function ───────────────────────────────────────────────────────
export async function track(
  event: AnalyticsEvent,
  properties: Record<string, unknown> = {}
): Promise<void> {
  if (!supabaseConfigured || !supabase) return;

  // Add to queue
  eventQueue.push({ event, properties });

  // Debounce flush — batch events every 5 seconds
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushQueue(), 5000);
}

async function flushQueue(): Promise<void> {
  if (!supabase || eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, eventQueue.length); // take all

  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    await supabase.from('analytics_events').insert(
      batch.map(({ event, properties }) => ({
        user_id:    userId,
        event,
        properties: {
          ...properties,
          app_version: (window as any).electronAPI
            ? 'electron'
            : 'web',
        },
      }))
    );
  } catch {
    // Put events back in queue if flush failed
    eventQueue.unshift(...batch);
  }
}

// ── Flush immediately (e.g. before app closes) ────────────────────────────────
export function flushNow(): void {
  if (flushTimer) clearTimeout(flushTimer);
  void flushQueue();
}
