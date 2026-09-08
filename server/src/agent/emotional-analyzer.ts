import { EmotionalTone, SpecificEmotion, SpeakingStyle, VoiceProsody } from '../state/types.js';

export interface EmotionAnalysisResult {
  emotion: SpecificEmotion;
  intensity: number;
  speakingStyle: SpeakingStyle;
  confidence: number;
  tone: EmotionalTone;
  ttsAdjustment: {
    rate: number;
    pitch: number;
    volume: number;
  };
  strategyGuidance: string;
}

export class EmotionalAnalyzer {
  public static analyzeTone(text: string, audioDurationMs?: number, prosody?: VoiceProsody): EmotionalTone {
    return this.analyzeEmotion(text, audioDurationMs, prosody).tone;
  }

  public static analyzeEmotion(
    text: string,
    audioDurationMs?: number,
    prosody?: VoiceProsody,
    context?: { currentTopic?: string; prevEmotion?: SpecificEmotion }
  ): EmotionAnalysisResult {
    const lower = text.toLowerCase().trim();
    const hasExclamation = text.includes('!');
    const hasAllCaps = /[A-Z]{3,}/.test(text);

    const isHighEnergy = prosody ? prosody.avgEnergy > 0.65 || prosody.peakEnergy > 0.8 : hasExclamation || hasAllCaps;
    const isLowEnergy = prosody ? prosody.avgEnergy < 0.25 && prosody.peakEnergy < 0.45 : false;
    const isRushed = prosody ? prosody.speakingRate === 'rushed' || prosody.speakingRate === 'fast' : false;
    const isSlow = prosody ? prosody.speakingRate === 'slow' : false;

    // 1. ANGRY / HOSTILE / HIGH FRUSTRATION (Text + High Energy Voice)
    if (
      /\b(angry|furious|pissed|rage|chup ho jao|shut up|bakwas band karo|hate you|gussa|hate this|stop talking|irritated|so mad)\b/i.test(lower) ||
      (/\b(what are you doing|why did you do that|useless|terrible)\b/i.test(lower) && isHighEnergy)
    ) {
      const intensity = isHighEnergy ? 0.92 : 0.8;
      return {
        emotion: 'angry',
        intensity,
        speakingStyle: 'serious',
        confidence: 0.92,
        tone: 'serious',
        ttsAdjustment: {
          rate: 0.95,
          pitch: 0.98,
          volume: 1.0
        },
        strategyGuidance: 'Calm, concise, reassuring, non-defensive. Do not repeatedly say "calm down". Acknowledge user feelings directly.'
      };
    }

    // 1b. AUTHORITY / WORKPLACE REPRIMAND (Boss Scolded, Manager Shouted, Teacher Scolded)
    if (
      /\b(my boss scolded me|boss scolded me|boss ne daanta|boss ne daant|boss shouted|boss yelled|manager scolded|manager yelled|scolded by my boss|scolded by boss|boss was mad|boss was angry|teacher scolded|scolded by teacher|professor scolded)\b/i.test(lower)
    ) {
      return {
        emotion: 'frustrated',
        intensity: 0.88,
        speakingStyle: 'emotional',
        confidence: 0.95,
        tone: 'serious',
        ttsAdjustment: {
          rate: 0.94,
          pitch: 0.96,
          volume: 0.95
        },
        strategyGuidance: 'Lead with sympathy and validation first ("Ugh, that is rough, what happened?" / "Yaar that sucks, kya bola usne?"). Do not lecture or analyze who was right unless asked.'
      };
    }

    // 2. EXCITED / BIG WIN / CELEBRATION (Job Offers, Promotions, Big News)
    if (
      /\b(aaj mujhe job mil gayi|mujhe job mil gayi|job mil gayi|got the job|got an offer|got a job offer|cleared the interview|crushed it|passed|won|we did it|great news|big win|so excited|yay|promoted|yesss|i got selected|selected for the job|cracked the interview|let's go)\b/i.test(lower) ||
      (/\b(finally|made it|i did it|omg)\b/i.test(lower) && (isHighEnergy || hasExclamation))
    ) {
      const intensity = isHighEnergy ? 0.98 : 0.92;
      return {
        emotion: 'excited',
        intensity,
        speakingStyle: 'rushed',
        confidence: 0.98,
        tone: 'excited',
        ttsAdjustment: {
          rate: 1.15,
          pitch: 1.12,
          volume: 1.0
        },
        strategyGuidance: 'Escalate energy and celebrate genuinely ("Wait WHAT, that\'s huge! Party toh banti hai! Congratulations!"). Scale response intensity to the big news.'
      };
    }

    // 3. ANXIOUS / NERVOUS (Interview Anxiety, Fear of Future)
    if (
      /\b(nervous|anxious|anxiety|scared|afraid|terrified|interview tomorrow|worried about future|future anxiety|panicking|stressing out)\b/i.test(lower)
    ) {
      const intensity = isRushed || isHighEnergy ? 0.88 : 0.8;
      return {
        emotion: 'anxious',
        intensity,
        speakingStyle: isRushed ? 'rushed' : 'hesitant',
        confidence: 0.92,
        tone: 'serious',
        ttsAdjustment: {
          rate: 0.96,
          pitch: 1.0,
          volume: 1.0
        },
        strategyGuidance: 'Slow down, grounded, reassuring. Validate their feelings ("Interviews can definitely make you nervous..."). Keep them focused on what they control.'
      };
    }

    // 4. STRESSED / OVERWHELMED
    if (/\b(stressed|really stressed|so stressed|overwhelmed|under pressure|panic|stress|too much pressure)\b/i.test(lower)) {
      return {
        emotion: 'stressed',
        intensity: 0.85,
        speakingStyle: 'hesitant',
        confidence: 0.9,
        tone: 'serious',
        ttsAdjustment: {
          rate: 0.95,
          pitch: 0.98,
          volume: 1.0
        },
        strategyGuidance: 'Calm and steady. Break things down into manageable steps.'
      };
    }

    // 5. SAD / LOW / CRYING / BAD DAY
    if (
      /\b(sad|depressed|down|unhappy|crying|broken|heartbroken|dukh|dukhi|really bad day|terrible day|feel like giving up|lonely|feeling low|lost someone)\b/i.test(lower) ||
      (isLowEnergy && isSlow && /\b(not good|bad|hurts|tired of everything)\b/i.test(lower))
    ) {
      return {
        emotion: 'sad',
        intensity: isLowEnergy ? 0.9 : 0.82,
        speakingStyle: 'emotional',
        confidence: 0.92,
        tone: 'sad',
        ttsAdjustment: {
          rate: 0.90,
          pitch: 0.95,
          volume: 0.92
        },
        strategyGuidance: 'Softer, slower, gentle, supportive delivery. Be present and empathetic ("Hey... it\'s okay. You don\'t have to pretend you\'re fine. I\'m listening.").'
      };
    }

    // 6. TIRED / EXHAUSTED
    if (/\b(tired|exhausted|drained|burned out|thak gaya|sleeping tired|no energy|fatigue|sleepy)\b/i.test(lower) || (isLowEnergy && isSlow)) {
      return {
        emotion: 'tired',
        intensity: 0.78,
        speakingStyle: 'calm',
        confidence: 0.88,
        tone: 'casual',
        ttsAdjustment: {
          rate: 0.92,
          pitch: 0.95,
          volume: 0.92
        },
        strategyGuidance: 'Gentle, shorter, soothing delivery. Acknowledge their fatigue and suggest resting.'
      };
    }

    // 7. FRUSTRATION (Bugs, errors, annoying issues)
    if (/\b(same error|annoying|irritating|frustrating|hate this bug|still failing|stuck again|tired of this|not working again|gussa|bakwas|annoy|you are annoying|you are so annoy)\b/i.test(lower)) {
      return {
        emotion: 'frustrated',
        intensity: 0.82,
        speakingStyle: 'rushed',
        confidence: 0.88,
        tone: 'frustrated',
        ttsAdjustment: {
          rate: 0.96,
          pitch: 1.0,
          volume: 1.0
        },
        strategyGuidance: 'Non-defensive, practical, slightly playful or reassuring depending on context.'
      };
    }

    // 8. CONFUSION / PUZZLED
    if (/\b(confused|lost|puzzled|don't get it|what does this mean|samajh nahi aaya|kya matlab|complicated|i don't understand|explain simply)\b/i.test(lower)) {
      return {
        emotion: 'confused',
        intensity: 0.75,
        speakingStyle: 'hesitant',
        confidence: 0.88,
        tone: 'confused',
        ttsAdjustment: {
          rate: 0.95,
          pitch: 1.0,
          volume: 1.0
        },
        strategyGuidance: 'Simplify the explanation. Patient, clear, step-by-step.'
      };
    }

    // 9. HAPPY / LIGHTHEARTED / BANTER
    if (/\b(haha|hahaha|lol|lmao|hilarious|funny|chutkula|laugh|happy|glad|awesome|great|good vibes|loving this)\b/i.test(lower)) {
      return {
        emotion: 'happy',
        intensity: 0.8,
        speakingStyle: 'playful',
        confidence: 0.88,
        tone: 'happy',
        ttsAdjustment: {
          rate: 1.08,
          pitch: 1.06,
          volume: 1.0
        },
        strategyGuidance: 'Warm, cheerful, playful delivery.'
      };
    }

    // 10. Default: Neutral / Casual
    return {
      emotion: 'neutral',
      intensity: 0.5,
      speakingStyle: 'casual',
      confidence: 0.7,
      tone: 'casual',
      ttsAdjustment: {
        rate: 1.05,
        pitch: 1.0,
        volume: 1.0
      },
      strategyGuidance: 'Natural Indian conversational style, warm, expressive, approachable.'
    };
  }

  /**
   * Safe boundary clamping for voice parameters ensuring zero distortion or browser crashes.
   */
  public static clampVoiceParameters(adj: { rate: number; pitch: number; volume: number }): {
    rate: number;
    pitch: number;
    volume: number;
  } {
    return {
      rate: Math.max(0.85, Math.min(1.25, Number(adj.rate.toFixed(2)))),
      pitch: Math.max(0.85, Math.min(1.20, Number(adj.pitch.toFixed(2)))),
      volume: Math.max(0.70, Math.min(1.00, Number(adj.volume.toFixed(2))))
    };
  }

  public static getTonePromptGuideline(tone: EmotionalTone): string {
    switch (tone) {
      case 'excited':
        return 'EXCITING NEWS / HIGH ENERGY: Match user enthusiasm naturally with celebratory, spontaneous energy.';
      case 'sad':
        return 'SADNESS / GRIEF DETECTED: Gentle, soft, comforting. Do not joke or minimize their feelings.';
      case 'serious':
        return 'SERIOUS / ANXIETY / HIGH-STAKES: Grounded, reassuring, empathetic tone without generic clichés.';
      case 'frustrated':
        return 'FRUSTRATION DETECTED: Calm, non-defensive, practical acknowledgment.';
      case 'confused':
        return 'CONFUSION DETECTED: Patient, clear, simplified explanation.';
      case 'surprised':
        return 'SURPRISE DETECTED: Spontaneous matched reaction.';
      case 'happy':
        return 'HAPPY / PLAYFUL: Warm, upbeat, cheerful conversational tone.';
      case 'casual':
      default:
        return 'CASUAL CONVERSATIONAL: Expressive, friendly, natural Hinglish touches ("haan", "acha", "arre yaar").';
    }
  }
}
