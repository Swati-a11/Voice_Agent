export class TTSService {
  // Common Romanized Hinglish phonetic mapping dictionary to help English TTS pronounce naturally
  private static HINGLISH_PHONETIC_MAP: Record<string, string> = {
    'kya': 'kyaa',
    'kaise': 'kay-say',
    'achha': 'uch-haa',
    'acha': 'uch-haa',
    'theek': 'theek',
    'sahi': 'suh-hee',
    'arre': 'uh-ray',
    'yaar': 'yaahr',
    'bhai': 'bhaay',
    'haan': 'haahn',
    'nahi': 'nuh-hee',
    'nahin': 'nuh-heen',
    'matlab': 'mut-lub',
    'thoda': 'thow-daa',
    'mast': 'must',
    'badhiya': 'budh-ee-ya',
    'chal': 'chull',
    'chalo': 'chull-o',
    'kuch': 'kuchh',
    'aaj': 'aahj',
    'kal': 'kull',
    'parso': 'pur-sow',
    'soch': 'soch',
    'samajh': 'sum-ujh',
    'lekin': 'lay-kin',
    'kyunki': 'kyoon-kee',
    'dekho': 'day-kho',
    'pehle': 'peh-lay',
    'karein': 'kuh-rayn',
    'hoga': 'how-gaa',
    'lag': 'lugg',
    'raha': 'ruh-haa',
    'rahi': 'ruh-hee',
    'bas': 'buss',
    'batao': 'buh-taa-o'
  };

  /**
   * Phonetically normalize text containing Romanized Hindi for smoother TTS pronunciation.
   */
  public static normalizeHinglishPhonetics(text: string): string {
    let normalized = text;
    for (const [hindiWord, phonetic] of Object.entries(TTSService.HINGLISH_PHONETIC_MAP)) {
      const regex = new RegExp(`\\b${hindiWord}\\b`, 'gi');
      normalized = normalized.replace(regex, (match) => {
        return match[0] === match[0].toUpperCase()
          ? phonetic.charAt(0).toUpperCase() + phonetic.slice(1)
          : phonetic;
      });
    }
    return normalized;
  }

  /**
   * Clean text for speech synthesis (strip markdown asterisks, emojis, code blocks, raw URLs).
   */
  public static sanitizeForSpeech(text: string): string {
    let clean = text;

    // 1. Replace multiline code blocks with clean natural phrase
    clean = clean.replace(/```[\s\S]*?```/g, 'Here is the code.');

    // 2. Strip inline code backticks: `const x = 10` -> const x = 10
    clean = clean.replace(/`([^`]+)`/g, '$1');

    // 3. Strip markdown headers (e.g. ### Header -> Header)
    clean = clean.replace(/^#{1,6}\s+(.+)$/gm, '$1');

    // 4. Strip markdown bold / italic asterisks & underscores (**text**, *text*, __text__, _text_)
    clean = clean.replace(/\*\*([^*]+)\*\*/g, '$1');
    clean = clean.replace(/\*([^*]+)\*/g, '$1');
    clean = clean.replace(/__([^_]+)__/g, '$1');
    clean = clean.replace(/_([^_]+)_/g, '$1');

    // 5. Clean markdown links: [link text](url) -> link text
    clean = clean.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // 6. Clean raw URLs (https://... or http://...) to avoid spelling out "h-t-t-p-s-colon-slash-slash"
    clean = clean.replace(/https?:\/\/(?:www\.)?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:\/[^\s]*)?/gi, '$1');

    // 7. Expand currency and percentages for natural speech
    clean = clean.replace(/₹\s*(\d+(?:,\d+)*(?:\.\d+)?)/g, '$1 rupees');
    clean = clean.replace(/Rs\.?\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi, '$1 rupees');
    clean = clean.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent');

    // 8. Strip emojis and unicode symbols
    clean = clean.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');

    // 9. Normalize whitespace
    clean = clean.replace(/\s+/g, ' ').trim();

    return clean;
  }

  /**
   * Synthesize text payload for browser streaming synthesis (₹0 cost).
   */
  public async synthesize(
    text: string
  ): Promise<{ cleanText: string; phoneticText: string; provider: 'browser' }> {
    const cleanText = TTSService.sanitizeForSpeech(text);
    const phoneticText = TTSService.normalizeHinglishPhonetics(cleanText);

    return {
      cleanText,
      phoneticText,
      provider: 'browser'
    };
  }
}
