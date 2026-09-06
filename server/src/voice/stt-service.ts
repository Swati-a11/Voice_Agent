import { LanguageMode } from '../state/types.js';

export class STTService {
  /**
   * Detect whether text is primarily English, Hindi (Devanagari/Romanized), or Hinglish code-mixed.
   */
  public detectLanguageMode(text: string): LanguageMode {
    const lower = text.toLowerCase();
    
    // Check for Devanagari Unicode range
    const hasDevanagari = /[\u0900-\u097F]/.test(text);
    
    // Common Hinglish / Romanized Hindi keywords
    const hinglishMarkers = [
      'yaar', 'arre', 'kya', 'hai', 'hain', 'ho', 'hoon', 'karna', 'karte', 'karein', 'batata',
      'achha', 'acha', 'theek', 'sahi', 'matlab', 'bhi', 'nahi', 'nahin', 'kaise', 'kuch', 'thoda',
      'aaj', 'kal', 'parso', 'batao', 'samajh', 'chal', 'mast', 'lekin', 'kyunki', 'bhai',
      'haan', 'dekho', 'bas', 'toh', 'ab', 'bolo', 'raha', 'rahi', 'hoga', 'hota', 'hote', 'pehle', 'lag'
    ];

    const words = lower.split(/\s+/);
    let hindiCount = 0;

    for (const w of words) {
      const clean = w.replace(/[^a-z]/g, '');
      if (hinglishMarkers.includes(clean)) {
        hindiCount++;
      }
    }

    if (hasDevanagari) {
      return words.length > hindiCount + 2 ? 'hinglish' : 'hindi';
    }

    if (hindiCount >= 1) {
      return 'hinglish';
    }

    return 'english';
  }
}
