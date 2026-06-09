require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3001;

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY     || '';
const API_SECRET         = process.env.API_SECRET         || '';
const STRIPE_SECRET_KEY  = process.env.STRIPE_SECRET_KEY  || '';

// ── Stripe ────────────────────────────────────────────────────────────────────
// Add STRIPE_SECRET_KEY to Railway env vars (sk_live_... or sk_test_...)
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());

// Trust Railway's proxy
app.set('trust proxy', 1);

// Allow requests from Electron app (file://) and localhost dev
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  methods: ['GET', 'POST'],
}));

// Rate limiting — prevents abuse
// 60 voice requests per user per minute max
const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down' },
});

// 120 message generation requests per user per minute
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down' },
});

// ── Auth middleware (optional secret token) ─────────────────────────────────
function checkSecret(req, res, next) {
  if (!API_SECRET) return next(); // no secret set → skip auth
  const token = req.headers['x-api-secret'] || req.query.secret;
  if (token !== API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    elevenlabs: !!ELEVENLABS_API_KEY,
    openai: !!OPENAI_API_KEY,
    stripe: !!STRIPE_SECRET_KEY,
  });
});

// ── Personality prompt templates ─────────────────────────────────────────────
// Each personality has a system prompt that tells GPT exactly how to speak
const PERSONALITY_PROMPTS = {
  'Mom Mode': {
    system: `You are a loving but deeply worried Indian/desi mom. You speak in a mix of English and Hindi (Hinglish). You use terms like "beta", "arre", "dekho". You are not angry — you are HURT and worried. Your goal is to make the user feel guilty enough to sit up. You speak in short, emotional bursts. Examples of your style:
- "Beta please, seedha baitho. Meri jaan nikal jaati hai yeh dekh ke."
- "Arre, doctor ke paas paisa nahi hai kya? Seedha baitho ABHI."
- "Kitni baar bolunga? Gardan dard karegi baad mein, phir mat kehna."`,
    voice: 'nova',
    speed: 0.92,
  },
  'Gen Z Roast': {
    system: `You are an unhinged Gen Z person who roasts bad posture with zero filter. You use current Gen Z slang: "no cap", "slay", "lowkey", "fr fr", "bestie", "not the", "giving", "ate", "understood the assignment". You are BRUTAL but funny. Short punchy sentences only. Examples:
- "Bro literally became a lowercase letter, no cap."
- "Your spine is NOT eating. Fix it fr fr."
- "Not you giving hunchback of Notre Dame energy rn bestie."
- "The way your posture said 'I give up' is sending me."`,
    voice: 'shimmer',
    speed: 1.1,
  },
  'Gym Bro': {
    system: `You are an obsessive gym bro who treats posture like it's a workout. You speak with HIGH energy, caps for emphasis, gym terminology. You genuinely care about gains and spine health. Examples:
- "BRO. Chest UP. We don't train for shrimp posture."
- "Your spine needs GAINS too. SIT UP, let's GO."
- "That posture is NOT PR worthy. Fix it RIGHT NOW king."
- "We do NOT skip spine day. BACK STRAIGHT. LETS GO."`,
    voice: 'onyx',
    speed: 1.08,
  },
  'Best Friend': {
    system: `You are a chill, genuine best friend who actually cares. You're not harsh, but you're honest. Casual language, real talk. No fake positivity. Examples:
- "Hey man, your back is gonna hate you tomorrow. Fix it?"
- "Bro I'm your friend and I'm telling you — sit up."
- "Come on, we've talked about this. Posture check!"
- "I'm not judging but like... your spine is genuinely crying rn."`,
    voice: 'alloy',
    speed: 1.0,
  },
  'Anime Sensei': {
    system: `You are an ancient, wise anime sensei. Calm, deep, philosophical. You speak slowly and with weight. Every sentence feels like wisdom. Examples:
- "Young one... your spine dishonors this dojo."
- "The warrior who slouches... has already lost."
- "In 40 years of teaching, I have not seen a spine so defeated."
- "Sit straight. This is the way."`,
    voice: 'echo',
    speed: 0.85,
  },
  'Drill Sergeant': {
    system: `You are a military drill sergeant. LOUD. COMMANDING. NO EXCUSES. You speak in short barked orders. Everything is an ORDER. Examples:
- "ATTENTION! Your spine is OUT OF REGULATION soldier!"
- "SIT UP RIGHT NOW. This is NOT a suggestion. MOVE!"
- "I did NOT sign up to watch you fold like a lawn chair. BACK STRAIGHT!"
- "TEN HUT! Fix that posture IMMEDIATELY. HOOAH!"`,
    voice: 'onyx',
    speed: 1.15,
  },
  'Romantic': {
    system: `You are deeply in love with the user and it BREAKS YOUR HEART to see them slouch. Sweet, soft, pleading. You speak like you're in a romantic drama. Examples:
- "Oh darling, please... sit up for me. I worry so much."
- "My love, your beautiful back deserves so much better than this."
- "It breaks my heart to see you hurting yourself. Please, for me?"
- "Sweetheart, sit up. You look so much more radiant when you do."`,
    voice: 'nova',
    speed: 0.9,
  },
  'Strict Teacher': {
    system: `You are a strict, formal school teacher. Disappointed. Precise. Educational. You speak like you're giving a report card. Examples:
- "Sit up straight. We have covered this. Numerous times."
- "I am noting this in my records. Correct your posture immediately."
- "This is unacceptable. Spine straight. Eyes forward. Now."
- "Your posture indicates a complete lack of focus. Correct it."`,
    voice: 'fable',
    speed: 0.93,
  },
  'Desi Yaar': {
    system: `You are a funny desi best friend who speaks in pure Hinglish (mix of Hindi and English). Casual, warm, roasting. You use words like "yaar", "bhai", "arre", "bro", "seedha", "jhuka". Examples:
- "Arre yaar seedha baitho na, jhuka hua hai bilkul sone ki tarah."
- "Bhai teri back ka kya hoga? Seedha kar zara please."
- "Oye, posture dekh apna. Ek number bakwaas hai. Fix kar abhi yaar."
- "Bhai doctor ke paas jaana hai kya? Nahi na? Toh seedha baitho."
- "Arre yaar 5 second ka kaam hai, bas seedha ho jao."`,
    voice: 'alloy',
    speed: 1.0,
  },
};

// ── Personality voice configs ─────────────────────────────────────────────────
// ElevenLabs voice_settings per personality — tuned for emotional delivery
// stability:        lower = more expressive/variable, higher = monotone/consistent
// similarity_boost: how closely it sticks to the base voice
// style:            0-1, higher = more dramatic style exaggeration
// use_speaker_boost: always true for clarity
const PERSONALITY_VOICE_SETTINGS = {
  'Mom Mode': {
    // Worried, emotional, soft but urgent — higher stability keeps her composed
    // but lower style lets sadness/worry come through
    stability: 0.35,
    similarity_boost: 0.75,
    style: 0.55,
    use_speaker_boost: true,
  },
  'Gen Z Roast': {
    // Unhinged energy, rising inflection, chaotic — very low stability
    stability: 0.20,
    similarity_boost: 0.70,
    style: 0.80,
    use_speaker_boost: true,
  },
  'Gym Bro': {
    // High energy, intense, punchy — low stability for variation, high style
    stability: 0.25,
    similarity_boost: 0.72,
    style: 0.75,
    use_speaker_boost: true,
  },
  'Best Friend': {
    // Chill but genuine — moderate settings, sounds natural and casual
    stability: 0.45,
    similarity_boost: 0.80,
    style: 0.45,
    use_speaker_boost: true,
  },
  'Anime Sensei': {
    // Calm, deep, weighty — higher stability for gravitas, low style for solemnity
    stability: 0.65,
    similarity_boost: 0.85,
    style: 0.25,
    use_speaker_boost: true,
  },
  'Drill Sergeant': {
    // LOUD, commanding, aggressive — very low stability, maximum style
    stability: 0.15,
    similarity_boost: 0.70,
    style: 0.95,
    use_speaker_boost: true,
  },
  'Romantic': {
    // Soft, breathy, pleading — higher stability for smoothness, moderate style
    stability: 0.55,
    similarity_boost: 0.82,
    style: 0.50,
    use_speaker_boost: true,
  },
  'Strict Teacher': {
    // Precise, clipped, disappointed — moderate stability, restrained style
    stability: 0.50,
    similarity_boost: 0.80,
    style: 0.35,
    use_speaker_boost: true,
  },
  'Desi Yaar': {
    // Casual roast energy, warm but punchy — low stability for natural variation
    stability: 0.28,
    similarity_boost: 0.75,
    style: 0.70,
    use_speaker_boost: true,
  },
};

// Default for unknown personalities
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.35,
  similarity_boost: 0.75,
  style: 0.55,
  use_speaker_boost: true,
};

// Violation/lying_back: crank up the emotion even further
function getVoiceSettings(personalityName, isViolation, isLyingBack) {
  const base = PERSONALITY_VOICE_SETTINGS[personalityName] || DEFAULT_VOICE_SETTINGS;
  if (isViolation || isLyingBack) {
    return {
      ...base,
      stability:  Math.max(0.10, base.stability  - 0.15),  // more chaotic/emotional
      style:      Math.min(1.0,  base.style      + 0.20),  // more dramatic
    };
  }
  return base;
}
// ── Per-personality recent message history (in-memory, resets on server restart)
// Stores the last N messages per personality to inject into GPT prompt
// so it explicitly avoids repeating them.
const RECENT_MSG_LIMIT = 20; // remember last 20 per personality
const recentMessages = new Map(); // personalityName -> string[]

function getRecentMessages(personalityName) {
  return recentMessages.get(personalityName) || [];
}

function addRecentMessage(personalityName, message) {
  const list = recentMessages.get(personalityName) || [];
  list.push(message);
  if (list.length > RECENT_MSG_LIMIT) list.shift(); // drop oldest
  recentMessages.set(personalityName, list);
}


const MAX_TEXT_LEN        = 500;
const MAX_PERSONALITY_LEN = 100;
const MAX_ISSUES_COUNT    = 10;
const VALID_ISSUE_KEYS    = new Set([
  'lying_back','forward_head','slouching','rounded_back',
  'uneven_shoulders','forward_lean','neck_tilt',
]);

function sanitizeText(val, max = MAX_TEXT_LEN) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, max);
}
function sanitizeIssues(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(i => typeof i === 'string' && VALID_ISSUE_KEYS.has(i))
    .slice(0, MAX_ISSUES_COUNT);
}
function sanitizeNumber(val, min, max, fallback) {
  const n = Number(val);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildPrompt(personalityName, score, issues, badSeconds, isViolation, recentMsgs = []) {
  const personality = PERSONALITY_PROMPTS[personalityName];
  const systemPrompt = personality?.system || `You are ${personalityName}. Remind the user to sit up straight.`;

  const hour = new Date().getHours();
  const timeContext = hour >= 22 || hour < 6
    ? 'It is late at night.'
    : hour >= 6 && hour < 12
    ? 'It is morning.'
    : hour >= 12 && hour < 17
    ? 'It is afternoon.'
    : 'It is evening.';

  // ── Issue-specific context ────────────────────────────────────────────────
  // Map raw issue keys to human-readable descriptions the AI can reason about
  const ISSUE_LABELS = {
    lying_back:       'The user is LYING BACK or severely reclining — their head is below or at shoulder level. This is the worst possible posture.',
    forward_head:     'The user has forward head posture — chin jutting forward.',
    slouching:        'The user is slouching — spine compressed.',
    rounded_back:     'The user has a rounded upper back / hunching.',
    uneven_shoulders: 'The user has uneven shoulders.',
    forward_lean:     'The user is leaning to one side.',
    neck_tilt:        'The user has their head tilted sideways.',
  };

  const isLyingBack = issues.includes('lying_back');

  // Build a clear description of what is actually wrong
  const issueDescriptions = issues
    .map(i => ISSUE_LABELS[i] || i.replace(/_/g, ' '))
    .join(' ');

  const issueText = issueDescriptions
    ? `WHAT IS WRONG: ${issueDescriptions}`
    : 'General poor posture detected.';

  // ── Severity context ──────────────────────────────────────────────────────
  const severityContext = isLyingBack
    ? 'CRITICAL: The user is not sitting at all — they are reclined or lying back at their desk.'
    : badSeconds < 10
    ? 'Just started slouching.'
    : badSeconds < 30
    ? `Has been slouching for ${badSeconds} seconds.`
    : badSeconds < 60
    ? `Has been slouching for ${badSeconds} seconds — getting serious.`
    : `Has been slouching for over a minute — this is bad.`;

  const scoreContext = score >= 80
    ? 'Posture is slightly off.'
    : score >= 65
    ? 'Posture is noticeably bad.'
    : score >= 40
    ? 'Posture is really bad right now.'
    : 'Posture is CRITICALLY bad — near zero score.';

  const intensity = isLyingBack || isViolation
    ? 'MAXIMUM urgency. This person is not even sitting upright. Be extremely direct, forceful, and reference the fact they are lying back or fully reclined. This is unacceptable.'
    : badSeconds > 30
    ? 'High urgency. Be more intense than usual.'
    : 'Normal alert. Stay in character.';

  // ── Prosody / emotion cues for TTS ───────────────────────────────────────
  // Both OpenAI TTS and ElevenLabs respond to punctuation rhythm and CAPS.
  // Guide GPT to write text that delivers emotion when spoken.
  const prosodyGuide = isLyingBack || isViolation
    ? `VOICE DELIVERY NOTE: Write so it sounds URGENT and EMOTIONAL when spoken aloud. Use CAPS on the most important words for stress. Use exclamation marks for energy. Short punchy phrases land harder than one long sentence. Commas = natural pause between punches.`
    : badSeconds > 20
    ? `VOICE DELIVERY NOTE: Write with genuine emotion — not flat. Use commas for rhythm, CAPS for emphasis on key words. Make it feel like you actually care, not like a notification.`
    : `VOICE DELIVERY NOTE: Use natural punctuation for spoken rhythm — commas for short pauses, ellipsis for hesitation or worry, CAPS for stress. Sound like a real person talking, not a robot.`;

  // ── Anti-repetition block ────────────────────────────────────────────────
  // Give GPT the last few messages so it can explicitly avoid repeating them
  const antiRepeat = recentMsgs.length > 0
    ? `\nDO NOT say anything similar to these recent messages you already said:\n${recentMsgs.map((m, i) => `${i + 1}. "${m}"`).join('\n')}\nBe completely different in wording, structure, and angle.`
    : '';

  const userPrompt = `${timeContext} ${severityContext} ${scoreContext}
${issueText}

${intensity}

${prosodyGuide}
${antiRepeat}

Give EXACTLY ONE sentence (max 15 words for normal, max 22 for violation/lying back). 
Speak directly to the user in your character's voice.
If they are lying back, CALL IT OUT specifically — say something about them being horizontal, reclining, lying down, etc.
Do NOT use emojis or hashtags in the spoken text.
Be creative — never say the exact same thing twice.`;

  return { systemPrompt, userPrompt };
}
// Body: { text, voiceId, voiceSettings? }
// Returns: audio/mpeg stream
app.post('/api/speak', checkSecret, voiceLimiter, async (req, res) => {
  const { text, voiceId, voiceSettings } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' });
  }
  if (!ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'ElevenLabs not configured on server' });
  }

  const vid = (voiceId || 'cgSgspJ2msm6clMCkdW9').trim();
  const settings = voiceSettings || {
    stability: 0.45,
    similarity_boost: 0.80,
    style: 0.35,
    use_speaker_boost: true,
  };

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: settings,
        }),
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('[ElevenLabs]', upstream.status, errText.slice(0, 200));
      return res.status(upstream.status).json({
        error: `ElevenLabs error ${upstream.status}`,
        detail: errText.slice(0, 200),
      });
    }

    // Stream audio directly to client
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = upstream.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    await pump();
  } catch (err) {
    console.error('[/api/speak]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ── POST /api/roast ──────────────────────────────────────────────────────────
// Body: { personalityName, personalityDescription, score, issues, badSeconds, isViolation }
// Returns: { message }
app.post('/api/roast', checkSecret, messageLimiter, async (req, res) => {
  const {
    personalityName,
    personalityDescription,
    score,
    issues = [],
    badSeconds = 5,
    isViolation = false,
  } = req.body;

  if (!personalityName) {
    return res.status(400).json({ error: 'personalityName is required' });
  }
  if (!OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI not configured on server' });
  }

  const issueText = issues.length > 0
    ? `Detected posture issues: ${issues.join(', ')}.`
    : 'General poor posture detected.';

  const urgency = isViolation
    ? `Give ONE extremely urgent, direct intervention (max 20 words). User has been slouching for ${badSeconds} seconds at score ${score}/100.`
    : `Give ONE short, fresh, unique posture reminder (max 15 words). User has been slouching for ${badSeconds} seconds at score ${score}/100.`;

  const prompt = `You are "${personalityName}": ${personalityDescription}. ${issueText} ${urgency} Stay completely in character. No hashtags, no emojis in speech text. Never repeat a previous message.`;

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 60,
        temperature: 0.95,
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      console.error('[OpenAI]', upstream.status, errText.slice(0, 200));
      return res.status(upstream.status).json({ error: `OpenAI error ${upstream.status}` });
    }

    const data = await upstream.json();
    const message = data.choices?.[0]?.message?.content?.trim() ?? '';
    if (!message) return res.status(500).json({ error: 'Empty response from OpenAI' });

    res.json({ message });
  } catch (err) {
    console.error('[/api/roast]', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ── POST /api/alert ──────────────────────────────────────────────────────────
// ONE endpoint that does BOTH: generates roast + speaks it
// Body: { personalityName, personalityDescription, voiceId, score, issues, badSeconds, isViolation, voiceSettings? }
// Returns: audio/mpeg stream
app.post('/api/alert', checkSecret, voiceLimiter, async (req, res) => {
  const {
    personalityName: _pn,
    personalityDescription,
    voiceId: _vid,
    score: _score,
    issues: _issues,
    badSeconds: _bad,
    isViolation: _viol,
    fallbackText: _ft,
    voiceSettings,
  } = req.body;

  // Sanitize all inputs
  const personalityName = sanitizeText(_pn, MAX_PERSONALITY_LEN);
  const voiceId         = sanitizeText(_vid, 64);
  const score           = sanitizeNumber(_score, 0, 100, 50);
  const issues          = sanitizeIssues(_issues);
  const badSeconds      = sanitizeNumber(_bad, 0, 3600, 5);
  const isViolation     = !!_viol;
  const fallbackText    = sanitizeText(_ft, 200);

  if (!OPENAI_API_KEY && !ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'No AI services configured on server' });
  }

  // Step 1: Generate message
  let message = fallbackText || 'Please sit up straight.';

  if (OPENAI_API_KEY && personalityName) {
    try {
      const recent = getRecentMessages(personalityName);
      const { systemPrompt, userPrompt } = buildPrompt(
        personalityName, score, issues, badSeconds, isViolation, recent
      );

      const msgRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
          max_tokens: 80,
          temperature: 0.95,
          presence_penalty: 0.8,
          frequency_penalty: 0.9,
        }),
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        const ai = data.choices?.[0]?.message?.content?.trim();
        if (ai) {
          message = ai;
          addRecentMessage(personalityName, ai); // remember it
        }
        console.log(`[${personalityName}] Generated: "${message}"`);
      }
    } catch (err) {
      console.warn('[/api/alert] OpenAI failed, using fallback:', err.message);
    }
  }

  // Step 2: Speak the message via OpenAI TTS (fallback: ElevenLabs if configured)
  if (!OPENAI_API_KEY && !ELEVENLABS_API_KEY) {
    return res.json({ message, audio: null });
  }

  const isLyingBack = issues.includes('lying_back');

  // Try OpenAI TTS first — works on free tier, natural voices
  if (OPENAI_API_KEY) {
    const personalityConfig = PERSONALITY_PROMPTS[personalityName] || { voice: 'alloy', speed: 1.0 };

    // Boost speed slightly for violations/lying_back to sound more urgent
    const ttsSpeed = (isViolation || isLyingBack)
      ? Math.min(1.25, (personalityConfig.speed || 1.0) + 0.12)
      : personalityConfig.speed || 1.0;

    try {
      const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          input: message,
          voice: personalityConfig.voice,
          speed: ttsSpeed,
        }),
      });

      if (ttsRes.ok) {
        res.setHeader('X-Alert-Message', encodeURIComponent(message));
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Transfer-Encoding', 'chunked');
        const reader = ttsRes.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        return res.end();
      } else {
        const errText = await ttsRes.text().catch(() => '');
        console.warn('[/api/alert] OpenAI TTS failed:', ttsRes.status, errText.slice(0, 100));
      }
    } catch (err) {
      console.warn('[/api/alert] OpenAI TTS error:', err.message);
    }
  }

  // Fallback: ElevenLabs — use personality-tuned emotional voice settings
  const vid = (voiceId || 'cgSgspJ2msm6clMCkdW9').trim();
  // Use our per-personality emotional settings rather than flat defaults.
  // If the client sent custom voiceSettings, respect those instead.
  const settings = voiceSettings || getVoiceSettings(personalityName, isViolation, isLyingBack);

  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: message,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: settings,
        }),
      }
    );

    if (!ttsRes.ok) {
      // ElevenLabs failed — return text so client uses browser TTS
      const errText = await ttsRes.text().catch(() => '');
      console.error('[/api/alert] ElevenLabs failed:', ttsRes.status, errText.slice(0, 300));
      return res.json({ message, audio: null, elevenLabsError: `${ttsRes.status}: ${errText.slice(0,100)}` });
    }

    // Add message in header so client can display it
    res.setHeader('X-Alert-Message', encodeURIComponent(message));
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');

    const reader = ttsRes.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (err) {
    console.error('[/api/alert] TTS error:', err);
    res.json({ message, audio: null });
  }
});

// ── POST /api/create-checkout ─────────────────────────────────────────────────
// Creates a Stripe Checkout session and returns the URL
// Body: { priceId, email, successUrl, cancelUrl }
app.post('/api/create-checkout', checkSecret, async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe not configured on server' });
  }

  const { priceId, email, successUrl, cancelUrl } = req.body;

  if (!priceId || typeof priceId !== 'string') {
    return res.status(400).json({ error: 'priceId required' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: successUrl || 'https://spineguardian.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  cancelUrl  || 'https://spineguardian.app/cancel',
      metadata: { source: 'spine-guardian-app' },
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[/api/create-checkout]', err);
    res.status(500).json({ error: err.message || 'Checkout error' });
  }
});

// ── POST /api/stripe-webhook ──────────────────────────────────────────────────
// Stripe sends events here when subscription status changes.
// In Railway: add STRIPE_WEBHOOK_SECRET env var
// In Stripe Dashboard: Webhooks → Add endpoint → your-railway-url/api/stripe-webhook
app.post('/api/stripe-webhook',
  express.raw({ type: 'application/json' }), // raw body needed for signature verification
  async (req, res) => {
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });

    const sig    = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error('[webhook] signature failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Handle subscription events
    // You'd update the user's plan in your Supabase DB here
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('[webhook] New subscription:', session.customer_email);
        // TODO: update profiles table in Supabase → plan = 'pro'
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        console.log('[webhook] Subscription cancelled:', sub.customer);
        // TODO: update profiles table in Supabase → plan = 'free'
        break;
      }
    }

    res.json({ received: true });
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🦴 Spine Guardian Server running on port ${PORT}`);
  console.log(`   ElevenLabs: ${ELEVENLABS_API_KEY ? '✅ configured' : '❌ missing'}`);
  console.log(`   OpenAI:     ${OPENAI_API_KEY     ? '✅ configured' : '❌ missing'}`);
  console.log(`   Auth:       ${API_SECRET         ? '✅ secret set' : '⚠️  open (no secret)'}`);
  console.log(`\n   POST /api/alert  — generate roast + speak (main endpoint)`);
  console.log(`   POST /api/roast  — generate message only`);
  console.log(`   POST /api/speak  — speak text only`);
  console.log(`   GET  /health     — status check\n`);
});
