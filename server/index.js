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

// ── POST /api/speak ──────────────────────────────────────────────────────────
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
    const issueText = issues.length > 0
      ? `Detected posture issues: ${issues.join(', ')}.`
      : 'General poor posture detected.';

    const urgency = isViolation
      ? `Give ONE extremely urgent intervention (max 20 words). User slouching ${badSeconds}s at score ${score}/100.`
      : `Give ONE short unique reminder (max 15 words). User slouching ${badSeconds}s at score ${score}/100.`;

    const prompt = `You are "${personalityName}": ${personalityDescription}. ${issueText} ${urgency} In character, no emojis in speech.`;

    try {
      const msgRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
      if (msgRes.ok) {
        const data = await msgRes.json();
        const ai = data.choices?.[0]?.message?.content?.trim();
        if (ai) message = ai;
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
    // Map personality to best OpenAI voice
    const voiceMap = {
      'Mom Mode':       'nova',     // warm female
      'Gen Z Roast':    'shimmer',  // energetic female
      'Gym Bro':        'onyx',     // deep male
      'Best Friend':    'alloy',    // neutral friendly
      'Anime Sensei':   'echo',     // calm male
      'Drill Sergeant': 'onyx',     // commanding
      'Romantic':       'nova',     // warm female
      'Strict Teacher': 'fable',    // authoritative
      'Desi Yaar':      'alloy',    // casual
    };
    const openAiVoice = voiceMap[personalityName] || 'alloy';

    try {
      const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: message,
          voice: openAiVoice,
          speed: 1.05,
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
