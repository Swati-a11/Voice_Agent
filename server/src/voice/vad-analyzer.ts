export interface ThoughtCompletionAnalysis {
  isComplete: boolean;
  confidence: number;
  reason: string;
  recommendedPauseMs: number;
}

export class VADAnalyzer {
  // English trailing patterns suggesting incomplete thought
  private static INCOMPLETE_ENGLISH_ENDINGS = [
    /\b(and|or|but|because|so|if|although|though|since|while|as|that|which|who|whom|whose)$/i,
    /\b(i was thinking|i mean|like|you know|uh|um|er|well|actually|honestly|basically)$/i,
    /\b(to|for|with|about|in|on|at|by|from|into|through|after|before)$/i,
    /\b(such as|for example|for instance|in order to|as well as)$/i,
    /\b(either|neither|not only|whether)$/i,
  ];

  // Hinglish trailing patterns suggesting incomplete thought
  private static INCOMPLETE_HINGLISH_ENDINGS = [
    /\b(aur|ya|par|lekin|kyunki|to|agar|jabki|jaisa ki|ki)$/i,
    /\b(matlab|jaise|woh|arre|soch raha tha|soch rahi thi|kya bolte hain)$/i,
    /\b(ke liye|ke sath|ke baare mein|mein|se|tak)$/i,
  ];

  // Definite question or sentence terminators suggesting completion
  private static COMPLETE_ENDINGS = [
    /[.?!]$/,
    /\b(right\?|haina\?|hai na\?|isn't it\?|you know\?|what do you think\?)$/i,
    /\b(kya lagta hai\?|batao|tell me|what's up\?|how about you\?)$/i,
  ];

  /**
   * Analyze whether the transcribed text so far looks like a completed thought
   * or if the user paused mid-sentence to think.
   */
  public static analyzeCompletion(transcript: string): ThoughtCompletionAnalysis {
    const text = transcript.trim();
    if (!text) {
      return {
        isComplete: false,
        confidence: 0.9,
        reason: 'Empty text',
        recommendedPauseMs: 700
      };
    }

    const words = text.split(/\s+/);
    const lastWord = words[words.length - 1].toLowerCase();

    // Check complete indicators
    for (const pattern of this.COMPLETE_ENDINGS) {
      if (pattern.test(text)) {
        return {
          isComplete: true,
          confidence: 0.88,
          reason: 'Explicit sentence or question termination detected',
          recommendedPauseMs: 350
        };
      }
    }

    // Check incomplete English indicators
    for (const pattern of this.INCOMPLETE_ENGLISH_ENDINGS) {
      if (pattern.test(text)) {
        return {
          isComplete: false,
          confidence: 0.85,
          reason: `Trailing English connector or filler: "${lastWord}"`,
          recommendedPauseMs: 800
        };
      }
    }

    // Check incomplete Hinglish indicators
    for (const pattern of this.INCOMPLETE_HINGLISH_ENDINGS) {
      if (pattern.test(text)) {
        return {
          isComplete: false,
          confidence: 0.85,
          reason: `Trailing Hinglish connector or filler: "${lastWord}"`,
          recommendedPauseMs: 800
        };
      }
    }

    // Very short single/double words (unless complete affirmative like "yes", "no", "haan", "theek hai")
    const shortAcks = ['yes', 'yeah', 'no', 'nope', 'haan', 'sahi', 'theek', 'sure', 'okay', 'done', 'yep'];
    if (words.length <= 2 && !shortAcks.includes(lastWord)) {
      return {
        isComplete: false,
        confidence: 0.65,
        reason: 'Short fragment likely mid-speech',
        recommendedPauseMs: 650
      };
    }

    // Default assumption for moderate-length multi-word clause
    return {
      isComplete: true,
      confidence: 0.75,
      reason: 'Grammatically plausible terminal clause',
      recommendedPauseMs: 380
    };
  }
}
