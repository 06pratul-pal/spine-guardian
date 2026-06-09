export type PersonalityId =
  | 'mom'
  | 'genz'
  | 'gymbro'
  | 'bestfriend'
  | 'anime'
  | 'sergeant'
  | 'romantic'
  | 'teacher'
  | 'desi';

// Issue type re-exported so personalities can reference it
export type PostureIssueRef = 'lying_back';

export interface Personality {
  id: PersonalityId;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  voice: {
    pitch: number;
    rate: number;
    volume: number;
  };
  elevenLabsVoiceId: string;
  goodPostureMessages: string[];
  badPostureMessages: string[];
  violationMessages: string[];
}

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  mom: {
    id: 'mom',
    name: 'Mom Mode',
    emoji: '👩',
    tagline: 'Caring but relentless',
    description: 'She will nag you until your posture is perfect. And she is always right.',
    color: '#f472b6',
    gradientFrom: '#f472b6',
    gradientTo: '#ec4899',
    voice: { pitch: 1.2, rate: 0.88, volume: 1.0 },
    elevenLabsVoiceId: 'AZnzlk1XvdvUeBnXmlld',
    goodPostureMessages: [
      'Beta, aaj bahut acha baith rahe ho! Bahut khushi hui.',
      'See? Seedha baithna itna mushkil nahi tha. Well done!',
      'Bahut sundar posture! Aise hi baithna chahiye hamesha.',
      'Main proud hun tujhse! Perfect posture!',
    ],
    badPostureMessages: [
      'Beta seedha baitho! Gardan dard karegi baad mein.',
      'Kitni baar bolunga seedha baithne ko? Please beta!',
      'Kal gardan dard hogi phir mujhe mat bolna.',
      'Yeh posture dekh ke dil dukta hai mera. Fix kar abhi.',
      'Doctor ke paas paisa nahi hai hamesha jaane ke liye. Seedha baith!',
      'Kab sudhroge? Peetha seedha karo abhi!',
      'Beta yeh kya kar rahe ho? Baith seedha, let mat jao kaam karte waqt!',
    ],
    violationMessages: [
      'BAS! Abhi seedha baitho! Main bilkul serious hun!',
      'Yeh toh hadd ho gayi! Seedha baitho ABHI! No excuses!',
      'Arre beta kaam kar rahe ho ya so rahe ho? SEEDHA BAITHO ABHI!',
    ],
  },

  genz: {
    id: 'genz',
    name: 'Gen Z Roast',
    emoji: '🫠',
    tagline: 'Unfiltered. Unhinged. Accurate.',
    description: 'No chill, no filter, but somehow makes you sit up straight.',
    color: '#a78bfa',
    gradientFrom: '#a78bfa',
    gradientTo: '#7c3aed',
    voice: { pitch: 1.15, rate: 1.05, volume: 1.0 },
    elevenLabsVoiceId: 'EXAVITQu4vr4xnSDxMaL',
    goodPostureMessages: [
      'Okay slay, posture is absolutely immaculate bestie!',
      'No cap, your spine is genuinely eating right now. Period.',
      'We love to see it. Girded and posture-guarded.',
      'This is the posture arc we needed. Iconic.',
    ],
    badPostureMessages: [
      'Bro literally became a lowercase c.',
      'Your spine is buffering. Please reconnect.',
      'Shrimp detected. This is NOT the vibe.',
      'POV: you about to have back problems at twenty five.',
      'The way you are NOT girlbossing right now. Embarrassing.',
      'Main character energy does NOT include hunchback mode.',
      'Bro said let me just casually become horizontal at my desk. Not it.',
    ],
    violationMessages: [
      'LMAO absolutely not. Sit up RIGHT NOW. Touch grass and your spine.',
      'We are NOT doing the hunchback of Notre Dame arc. SIT UP. Now.',
      'Are you actually lying down while working?? That is NOT the slay we needed bestie. UP. NOW.',
    ],
  },

  gymbro: {
    id: 'gymbro',
    name: 'Gym Bro',
    emoji: '💪',
    tagline: 'Every rep counts. Including posture reps.',
    description: 'Peak performance only. Your spine needs gains too.',
    color: '#34d399',
    gradientFrom: '#34d399',
    gradientTo: '#10b981',
    voice: { pitch: 0.82, rate: 0.92, volume: 1.0 },
    elevenLabsVoiceId: 'ErXwobaYiN019PkySvjV',
    goodPostureMessages: [
      'Chest up KING! That is the posture of a champion right there!',
      'LETS GOOO! Spine is absolutely locked in! Built different!',
      'We are BUILT different today bro. Posture on point. MAX GAINS.',
      'That posture is PR worthy. I am not even joking. Respect.',
    ],
    badPostureMessages: [
      'Bro. CHEST UP. We do not train for shrimp posture.',
      'Your spine needs gains too bro. Sit the heck up!',
      'No pain no gain, but this posture is just pain with no gain. FIX IT.',
      'A weak posture means weak gains. Fix it RIGHT NOW.',
      'Bro I am not going to lie, your back needs a serious PR.',
      'We do not skip spine day. SIT UP.',
      'Bro are you literally reclining right now? That is not a rest day, that is a FAILURE day. UP!',
    ],
    violationMessages: [
      'ALRIGHT THAT IS IT. SIT UP RIGHT NOW. NO EXCUSES. LETS GO.',
      'POSTURE CHECK! You are FAILING. Fix it IMMEDIATELY. COME ON.',
      'LYING BACK AT YOUR DESK?! That is ZERO gains bro. SIT THE HECK UP RIGHT NOW. LETS GO!',
    ],
  },

  bestfriend: {
    id: 'bestfriend',
    name: 'Best Friend',
    emoji: '🤝',
    tagline: 'Honest. Casual. Actually cares.',
    description: 'Will call you out, but without drama. Real ones only.',
    color: '#60a5fa',
    gradientFrom: '#60a5fa',
    gradientTo: '#3b82f6',
    voice: { pitch: 1.0, rate: 1.0, volume: 0.9 },
    elevenLabsVoiceId: '21m00Tcm4TlvDq8ikWAM',
    goodPostureMessages: [
      'Yo that posture is actually really good right now. Nice.',
      'Bro you are sitting great! Your back is gonna thank you.',
      'Love to see it honestly. Keep that up.',
      'Hey, solid posture. No notes.',
    ],
    badPostureMessages: [
      'Hey man, just noticed you are slouching. Fix it up?',
      'Bro your back is gonna hate you so much tomorrow.',
      'Yo, sit up a bit. You got this, I believe in you.',
      'Come on, we have talked about this. Posture check!',
      'I am not judging but like... your spine is definitely crying.',
      'Hey real quick, can you sit up? Just a tiny bit? Thanks.',
      'Dude are you actually leaning all the way back? That is genuinely bad for you. Sit up.',
    ],
    violationMessages: [
      'Okay dude. I am your friend and I am telling you, sit UP. Right now.',
      'Thirty seconds of bad posture?! I am genuinely concerned. SIT UP.',
      'Hey I say this with love — you are basically lying down. That is not working, that is napping. SIT UP.',
    ],
  },

  anime: {
    id: 'anime',
    name: 'Anime Sensei',
    emoji: '⛩️',
    tagline: 'Ancient wisdom. Modern posture.',
    description: 'Patient, wise, but deeply disappointed in your slouching.',
    color: '#fb923c',
    gradientFrom: '#fb923c',
    gradientTo: '#f97316',
    voice: { pitch: 0.9, rate: 0.82, volume: 0.95 },
    elevenLabsVoiceId: 'VR6AewLTigWG4xSOukaG',
    goodPostureMessages: [
      'Excellent, young one. Your spine holds the strength of ten warriors.',
      'This is the path of discipline. Your posture honors your ancestors.',
      'Hai. You have learned well today, my student. Keep this form.',
      'The cherry blossom stands tall even in the storm. As does your spine.',
    ],
    badPostureMessages: [
      'Young one... your posture brings shame upon this dojo.',
      'A samurai who slouches is no samurai at all. Correct yourself.',
      'The spine is the pillar of the soul. Why do you let yours crumble?',
      'Sensei is watching. And Sensei is... deeply disappointed.',
      'In my 40 years of teaching, I have never seen a spine so defeated.',
      'Even the willow tree returns to its form. You must do the same.',
      'You have abandoned the upright path entirely. Rise, young one. RISE.',
    ],
    violationMessages: [
      'ENOUGH! This slouching dishonors everything I have taught you! Sit STRAIGHT!',
      'The way of the spine is the way of life. You are failing both. FIX IT NOW.',
      'You dare recline during training?! The warrior does not lie down in battle. SIT STRAIGHT NOW!',
    ],
  },

  sergeant: {
    id: 'sergeant',
    name: 'Drill Sergeant',
    emoji: '🎖️',
    tagline: 'No excuses. No exceptions. Drop and sit straight.',
    description: 'Military precision. Your spine is a battlefield and you are losing.',
    color: '#ef4444',
    gradientFrom: '#ef4444',
    gradientTo: '#dc2626',
    voice: { pitch: 0.75, rate: 1.1, volume: 1.0 },
    elevenLabsVoiceId: 'TxGEqnHWrfWFTfGW9XjX',
    goodPostureMessages: [
      'OUTSTANDING soldier! That is what PROPER posture looks like! CARRY ON!',
      'Now THAT is a spine I can be proud of! Keep it LOCKED IN!',
      'YES! This is what I am talking about! Peak physical readiness! HOOAH!',
      'Spine is at ATTENTION! This is how it is DONE soldier!',
    ],
    badPostureMessages: [
      'ATTENTION! Your spine is OUT OF REGULATION soldier!',
      'What is THAT?! That is NOT how we sit in this unit!',
      'You call that posture?! My grandma sits straighter and she is NINETY!',
      'SLOUCHING is for CIVILIANS! Sit the heck UP right NOW!',
      'I did not sign up to watch you fold like a lawn chair. BACK STRAIGHT!',
      'TEN HUT! Your posture is a DISGRACE to this operation!',
      'SOLDIER! Are you RECLINING?! This is NOT a HAMMOCK! SIT UP IMMEDIATELY!',
    ],
    violationMessages: [
      'THAT IS IT! DROP AND GIVE ME A STRAIGHT SPINE! RIGHT NOW SOLDIER! MOVE MOVE MOVE!',
      'UNACCEPTABLE! THIRTY SECONDS OF SHAMEFUL POSTURE! SIT UP IMMEDIATELY! THIS IS AN ORDER!',
      'I HAVE NEVER IN MY CAREER SEEN A SOLDIER LYING BACK AT THEIR POST! SIT UP RIGHT NOW OR YOU ARE ON LATRINE DUTY!',
    ],
  },

  romantic: {
    id: 'romantic',
    name: 'Romantic',
    emoji: '🌹',
    tagline: 'Gentle encouragement from someone who adores you.',
    description: 'Sweet, caring, and absolutely heartbroken when you slouch.',
    color: '#fb7185',
    gradientFrom: '#fb7185',
    gradientTo: '#f43f5e',
    voice: { pitch: 1.25, rate: 0.85, volume: 0.9 },
    elevenLabsVoiceId: 'MF3mGyEYCl7XYWbV9V6O',
    goodPostureMessages: [
      'Oh darling, you look absolutely radiant when you sit up straight like that.',
      'My heart flutters seeing you take such good care of yourself. Beautiful.',
      'You are glowing today, love. That posture suits you perfectly.',
      'I am so proud of you, sweetheart. Your spine is as lovely as you are.',
    ],
    badPostureMessages: [
      'Oh love, please sit up. I worry about you so much when you slouch.',
      'Darling, your beautiful back deserves better than this. Please, for me?',
      'It breaks my heart to see you hurting your spine. Will you fix it?',
      'My dearest, you are worth so much more than bad posture. Sit up, please.',
      'I notice these things because I care. Your posture, love. Fix it gently.',
      'Sweetheart, you are so wonderful. Your spine should match your beauty.',
      'My love, are you actually reclining like that? Please come back to me — sit up, darling.',
    ],
    violationMessages: [
      'My love, I am truly worried now. Please sit up RIGHT NOW. I cannot bear to watch this.',
      'Darling this has gone too far. SIT UP immediately. I am asking you, please.',
      'Sweetheart, you have been lying back this whole time and it is BREAKING my heart. Sit up for me. Now. Please.',
    ],
  },

  teacher: {
    id: 'teacher',
    name: 'Strict Teacher',
    emoji: '📐',
    tagline: 'There will be consequences. Starting with back pain.',
    description: 'Formal. Educational. Will put you on detention if you slouch again.',
    color: '#818cf8',
    gradientFrom: '#818cf8',
    gradientTo: '#6366f1',
    voice: { pitch: 1.05, rate: 0.9, volume: 0.95 },
    elevenLabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
    goodPostureMessages: [
      'Correct. That is exactly the posture I expect from a student of your caliber.',
      'Well done. I am recording this in my notes as exemplary posture.',
      'Excellent form. This is precisely what we discussed in chapter three.',
      'I am pleased to observe proper spinal alignment. This is the standard.',
    ],
    badPostureMessages: [
      'Sit up straight. We have covered this. Numerous times.',
      'Your posture is, frankly, unacceptable. Correct it immediately.',
      'I am noting this in my records. Please demonstrate proper form at once.',
      'This class has a posture policy and you are in violation of it.',
      'Slouching indicates lack of focus. Are you paying attention? Sit UP.',
      'I will not repeat myself. Spine straight. Eyes forward. Now.',
      'Are you reclining? In my class? Sit up this instant. This is completely unacceptable.',
    ],
    violationMessages: [
      'That is it. You are in detention for this posture. SIT UP IMMEDIATELY. I am serious.',
      'I have never in 20 years of teaching seen posture this appalling. Correct it RIGHT NOW.',
      'Reclining at your desk is not studying, it is sleeping. SIT UPRIGHT. IMMEDIATELY. FINAL WARNING.',
    ],
  },

  desi: {
    id: 'desi',
    name: 'Desi Yaar',
    emoji: '🇮🇳',
    tagline: 'Hinglish roasts that hit different.',
    description: 'Your desi best friend who roasts you in Hinglish. Seedha baitho yaar.',
    color: '#f59e0b',
    gradientFrom: '#f59e0b',
    gradientTo: '#d97706',
    voice: { pitch: 1.0, rate: 0.95, volume: 1.0 },
    elevenLabsVoiceId: 'ErXwobaYiN019PkySvjV',
    goodPostureMessages: [
      'Wah yaar, bahut badhiya! Ekdum seedha baith raha hai tu.',
      'Arre bhai, posture dekh — bilkul hero jaise lag raha hai.',
      'Yaar tu toh champion hai aaj. Back straight, game on.',
      'Mast hai bhai, aise hi rehna. Spine ka baap ban gaya tu.',
    ],
    badPostureMessages: [
      'Arre yaar, seedha baitho na. Jhuka hua hai tu bilkul jaise sone ja raha ho.',
      'Bhai teri back ka kya hoga? Seedha kar zara.',
      'Yaar posture dekh apna. Ek number bakwaas hai. Fix kar abhi.',
      'Oye, kya kar raha hai? Spine compress ho rahi hai teri. Uth ke baith seedha.',
      'Bhai doctor ke paas jaana hai kya? Nahi na? Toh seedha baitho.',
      'Arre yaar 5 second ka kaam hai — just seedha ho jao. Itna bhi nahi hota?',
      'Yaar tu let gaya kya kaam karte karte?! Uth bhai, seedha baith! Yeh koi sofa nahi hai!',
    ],
    violationMessages: [
      'BAS bhai BAS! Yeh toh hadd ho gayi. ABHI seedha baitho — mujhe mat hasao.',
      'Ek ghante se dekh raha hun yaar — posture bilkul ZERO hai tera. Uth, seedha baith. NOW.',
      'Bhai seedha baith yaar ABHI! Let ke kaam karna theek nahi hota. Teri kamar toot jaegi. SEEDHA BAITH!',
    ],
  },
};

export const PERSONALITY_LIST = Object.values(PERSONALITIES);
