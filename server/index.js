require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3001;

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const OPENAI_API_KEY     = process.env.OPENAI_API_KEY     || '';
const API_SECRET         = process.env.API_SECRET         || '';

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

// ── Build dynamic prompt ──────────────────────────────────────────────────────
function buildPrompt(personalityName, score, issues, badSeconds, isViolation) {
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

  const issueText = issues.length > 0
    ? `Specific issues: ${issues.map(i => i.replace(/_/g, ' ')).join(', ')}.`
    : '';

  const severityContext = badSeconds < 10
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
    : 'Posture is really bad right now.';

  const intensity = isViolation
    ? 'MAXIMUM urgency. This is a violation. Be extremely direct and forceful.'
    : badSeconds > 30
    ? 'High urgency. Be more intense than usual.'
    : 'Normal alert. Stay in character.';

  const userPrompt = `${timeContext} ${severityContext} ${scoreContext} ${issueText}

${intensity}

Give EXACTLY ONE sentence (max 15 words for normal, max 20 for violation). 
Speak directly to the user in your character's voice.
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
    personalityName,
    personalityDescription,
    voiceId,
    score,
    issues = [],
    badSeconds = 5,
    isViolation = false,
    fallbackText,
    voiceSettings,
  } = req.body;

  if (!OPENAI_API_KEY && !ELEVENLABS_API_KEY) {
    return res.status(503).json({ error: 'No AI services configured on server' });
  }

  // Step 1: Generate message
  let message = fallbackText || 'Please sit up straight.';

  if (OPENAI_API_KEY && personalityName) {
    try {
      const { systemPrompt, userPrompt } = buildPrompt(
        personalityName, score, issues, badSeconds, isViolation
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
          presence_penalty: 0.6,
          frequency_penalty: 0.8,
        }),
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        const ai = data.choices?.[0]?.message?.content?.trim();
        if (ai) message = ai;
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

  // Try OpenAI TTS first — works on free tier, natural voices
  if (OPENAI_API_KEY) {
    const personalityConfig = PERSONALITY_PROMPTS[personalityName] || { voice: 'alloy', speed: 1.0 };

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
          speed: personalityConfig.speed,
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

  // Fallback: ElevenLabs if available

  const vid = (voiceId || 'cgSgspJ2msm6clMCkdW9').trim();
  const settings = voiceSettings || {
    stability: 0.45,
    similarity_boost: 0.80,
    style: 0.35,
    use_speaker_boost: true,
  };

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
