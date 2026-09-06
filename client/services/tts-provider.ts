/**
 * TTS Provider Abstraction Layer
 * Centralized fail-safe browser speech controller with:
 * - Direct browser synthesis state validation (speaking, pending, paused)
 * - Automatic pause recovery and lazy voice caching
 * - 2-attempt retry logic on unexpected drop
 * - Emotional tone modulation (rate, pitch, volume)
 * - Comprehensive structured logging: [TTS START], [TTS END], [TTS ERROR], [TTS CANCEL], [TTS RETRY], [TTS STALE]
 */

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voiceGender?: 'female' | 'male';
  lang?: string;
  sessionId?: number;
  turnId?: string;
  generationId?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface TTSProvider {
  speak(text: string, options?: TTSOptions): Promise<void>;
  stop(): void;
  isAvailable(): boolean;
  getVoices(): SpeechSynthesisVoice[];
  getPreferredVoice(): SpeechSynthesisVoice | null;
}

// Global active utterance store to prevent Chromium Garbage Collection bug
const activeUtterancesSet = new Set<SpeechSynthesisUtterance>();

// Male voice keywords to strictly avoid for female Ayra persona
const MALE_VOICE_KEYWORDS = [
  'male', 'man', 'guy', 'boy', 'rishi', 'daniel', 'george', 'david', 'mark',
  'alex', 'fred', 'tom', 'oliver', 'arthur', 'aaron', 'albert', 'bruce',
  'ralph', 'junior', 'whisper', 'deranged', 'bells', 'boing', 'cellos',
  'good news', 'organ', 'superstar', 'trinoids', 'zarvox', 'yuri', 'diego',
  'jorge', 'juan', 'paolo', 'stefan', 'thomas', 'karl'
];

// Female voice keywords for Ayra persona priority
const FEMALE_VOICE_KEYWORDS = [
  'female', 'woman', 'girl', 'neerja', 'heera', 'veena', 'samantha', 'victoria',
  'karen', 'tessa', 'moira', 'fiona', 'serena', 'kate', 'ava', 'allison',
  'susan', 'zira', 'jenny', 'aria', 'sonia', 'aditi', 'lekha', 'priya',
  'swara', 'anjali', 'shreya', 'shruti', 'pooja', 'sneha', 'monica', 'stephanie',
  'google uk english female', 'google us english female'
];

function isExplicitlyMale(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase();
  return MALE_VOICE_KEYWORDS.some((k) => name.includes(k)) && !name.includes('female');
}

function isExplicitlyFemale(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase();
  if (name.includes('female') || name.includes('woman')) return true;
  return FEMALE_VOICE_KEYWORDS.some((k) => name.includes(k));
}

let hasLoggedVoicesOnce = false;

export class BrowserTTSProvider implements TTSProvider {
  private cachedVoice: SpeechSynthesisVoice | null = null;
  public activeGenerationId: number = 0;
  private voiceSettings = {
    rate: 1.05,
    pitch: 1.0,
    volume: 1.0
  };
  private activeFinishCallbacks = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoiceSelection();
      window.speechSynthesis.onvoiceschanged = () => {
        console.log('[VOICE TRACE] voiceschanged fired, re-evaluating female voice selection...');
        this.initVoiceSelection();
      };
    }
  }

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isAvailable()) return [];
    try {
      return window.speechSynthesis.getVoices() || [];
    } catch (e) {
      return [];
    }
  }

  /**
   * High-priority natural FEMALE voice selection:
   * 1. en-IN Female Voice (Neerja, Heera, Veena, Google en-IN Female)
   * 2. Any Indian English Voice (excluding male)
   * 3. Natural / Neural English Female Voice (Samantha, Victoria, Karen, Zira, Jenny, Aria, Ava, etc.)
   * 4. Any English Voice (excluding male)
   * 5. Any Female Voice in any language
   * 6. Browser default fallback
   */
  public initVoiceSelection(): SpeechSynthesisVoice | null {
    if (!this.isAvailable()) return null;
    const voices = this.getVoices();
    if (voices.length === 0) return null;

    if (!hasLoggedVoicesOnce) {
      hasLoggedVoicesOnce = true;
      console.log(
        '[TTS VOICES] Available browser voices:',
        voices.map((v) => `${v.name} (${v.lang})`)
      );
    }

    // Retain cached voice if still available and confirmed female
    if (this.cachedVoice && voices.some((v) => v.name === this.cachedVoice?.name) && !isExplicitlyMale(this.cachedVoice)) {
      return this.cachedVoice;
    }

    // 1. Natural / Neural en-IN Indian English Female Voice (Ayra Top Priority)
    const indianFemale = voices.find(
      (v) =>
        (v.lang === 'en-IN' || v.lang.startsWith('en-IN') || v.name.toLowerCase().includes('india')) &&
        isExplicitlyFemale(v) &&
        !isExplicitlyMale(v)
    );
    if (indianFemale) {
      this.cachedVoice = indianFemale;
      console.log(`[TTS VOICE SELECTED] (1. en-IN Female) "${indianFemale.name}" (${indianFemale.lang})`);
      return this.cachedVoice;
    }

    // 2. Any en-IN Indian English Voice that is NOT male
    const indianNonMale = voices.find(
      (v) => (v.lang === 'en-IN' || v.lang.startsWith('en-IN')) && !isExplicitlyMale(v)
    );
    if (indianNonMale) {
      this.cachedVoice = indianNonMale;
      console.log(`[TTS VOICE SELECTED] (2. en-IN Non-Male) "${indianNonMale.name}" (${indianNonMale.lang})`);
      return this.cachedVoice;
    }

    // 3. High-Quality Natural English Female Voice (en-US, en-GB, en-AU, en-CA, en-IE)
    const naturalEnglishFemale = voices.find(
      (v) => v.lang.startsWith('en') && isExplicitlyFemale(v) && !isExplicitlyMale(v)
    );
    if (naturalEnglishFemale) {
      this.cachedVoice = naturalEnglishFemale;
      console.log(`[TTS VOICE SELECTED] (3. English Female) "${naturalEnglishFemale.name}" (${naturalEnglishFemale.lang})`);
      return this.cachedVoice;
    }

    // 4. Any English Voice that is NOT explicitly male
    const englishNonMale = voices.find((v) => v.lang.startsWith('en') && !isExplicitlyMale(v));
    if (englishNonMale) {
      this.cachedVoice = englishNonMale;
      console.log(`[TTS VOICE SELECTED] (4. English Non-Male) "${englishNonMale.name}" (${englishNonMale.lang})`);
      return this.cachedVoice;
    }

    // 5. Any Female Voice in any language
    const anyFemale = voices.find((v) => isExplicitlyFemale(v) && !isExplicitlyMale(v));
    if (anyFemale) {
      this.cachedVoice = anyFemale;
      console.log(`[TTS VOICE SELECTED] (5. General Female) "${anyFemale.name}" (${anyFemale.lang})`);
      return this.cachedVoice;
    }

    // 6. Browser default fallback
    this.cachedVoice = voices[0] || null;
    console.log(`[TTS VOICE SELECTED] (6. Fallback) "${this.cachedVoice?.name}" (${this.cachedVoice?.lang})`);
    return this.cachedVoice;
  }

  public getPreferredVoice(): SpeechSynthesisVoice | null {
    if (!this.cachedVoice) {
      this.initVoiceSelection();
    }
    return this.cachedVoice;
  }

  public setVoiceSettings(settings: Partial<{ rate: number; pitch: number; volume: number }>): void {
    this.voiceSettings = { ...this.voiceSettings, ...settings };
  }

  /**
   * Check and recover browser speech synthesis engine state
   */
  public ensureSynthesisActive(): void {
    if (!this.isAvailable()) return;
    try {
      if (window.speechSynthesis.paused) {
        console.log('[TTS DEBUG] ensureSynthesisActive: resuming paused speechSynthesis');
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn('[TTS ERROR] Error checking/resuming synthesis state:', e);
    }
  }

  /**
   * Speak a single utterance with auto-retry, state validation, and centralized lifecycle
   */
  public async speak(text: string, options: TTSOptions = {}): Promise<void> {
    const cleanText = text.trim();
    if (!cleanText || !this.isAvailable()) {
      return;
    }

    // Stale generation check
    if (options.generationId && this.activeGenerationId && options.generationId < this.activeGenerationId) {
      console.log(`[TTS STALE] Dropping stale utterance gen #${options.generationId} (active: #${this.activeGenerationId})`);
      return;
    }

    if (options.generationId) {
      this.activeGenerationId = Math.max(this.activeGenerationId, options.generationId);
    }

    const maxRetries = 2;
    let attempt = 0;
    let succeeded = false;

    while (attempt < maxRetries && !succeeded) {
      attempt++;
      try {
        if (attempt > 1) {
          console.log(`[TTS RETRY] gen #${options.generationId || 0} attempt #${attempt}`);
        }
        await this.executeSpeakAttempt(cleanText, options, attempt);
        succeeded = true;
      } catch (err: any) {
        if (
          options.generationId &&
          this.activeGenerationId &&
          options.generationId < this.activeGenerationId
        ) {
          console.log(`[TTS STALE] Dropping retry for superseded gen #${options.generationId}`);
          return;
        }

        if (attempt < maxRetries) {
          try {
            console.log('[TTS DEBUG] Cancelling before retry attempt');
            window.speechSynthesis.cancel();
          } catch (e) {}
          await new Promise((r) => setTimeout(r, 80));
        } else {
          console.warn(`[TTS ERROR] gen #${options.generationId || 0} error=${err?.message || err}`);
          options.onError?.(err);
        }
      }
    }
  }

  /**
   * Single speech attempt promise with robust timeouts and lifecycle events
   */
  private executeSpeakAttempt(cleanText: string, options: TTSOptions, attemptNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ensureSynthesisActive();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      // Safe boundary clamps preventing extreme speech distortion
      utterance.rate = Math.max(0.75, Math.min(1.35, options.rate ?? this.voiceSettings.rate));
      utterance.pitch = Math.max(0.80, Math.min(1.25, options.pitch ?? this.voiceSettings.pitch));
      utterance.volume = Math.max(0.50, Math.min(1.0, options.volume ?? this.voiceSettings.volume));

      const voice = this.getPreferredVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = options.lang || 'en-US';
      }

      activeUtterancesSet.add(utterance);
      let isDone = false;
      let hasStarted = false;
      const startTime = Date.now();

      const finish = (isCancel = false) => {
        if (isDone) return;
        isDone = true;
        this.activeFinishCallbacks.delete(finish);
        activeUtterancesSet.delete(utterance);
        clearTimeout(watchdog);
        clearTimeout(startWatchdog);

        if (options.generationId && this.activeGenerationId && options.generationId < this.activeGenerationId) {
          console.log(`[TTS STALE] Callback ignored for old gen #${options.generationId} (active: #${this.activeGenerationId})`);
          resolve();
          return;
        }

        if (isCancel) {
          console.log(`[TTS CANCEL] gen #${options.generationId || 0} cancelled`);
        } else {
          console.log(`[TTS END] gen #${options.generationId || 0} duration=${Date.now() - startTime}ms`);
          options.onEnd?.();
        }
        resolve();
      };

      const fail = (errorObj: any) => {
        if (isDone) return;
        isDone = true;
        this.activeFinishCallbacks.delete(finish);
        activeUtterancesSet.delete(utterance);
        clearTimeout(watchdog);
        clearTimeout(startWatchdog);

        if (options.generationId && this.activeGenerationId && options.generationId < this.activeGenerationId) {
          console.log(`[TTS STALE] Fail callback ignored for old gen #${options.generationId}`);
          resolve();
          return;
        }
        reject(errorObj);
      };

      this.activeFinishCallbacks.add(() => finish(true));

      // Start watchdog: if speech hasn't started within 2500ms, force resume or fail attempt for clean retry
      const startWatchdog = setTimeout(() => {
        if (!hasStarted && !isDone) {
          if (options.generationId && this.activeGenerationId && options.generationId < this.activeGenerationId) {
            finish(true);
            return;
          }
          if (window.speechSynthesis.paused) {
            console.log('[TTS DEBUG] startWatchdog: resuming paused speechSynthesis');
            window.speechSynthesis.resume();
          }
          if (attemptNumber === 1) {
            fail(new Error('SpeechSynthesis failed to start within timeout'));
          }
        }
      }, 2500);

      // Total playback watchdog: guarantees we never get stuck indefinitely
      const maxDurationMs = Math.max(2000, cleanText.length * 110 + 1500);
      const watchdog = setTimeout(() => {
        if (!isDone) {
          console.warn(`[TTS END] Watchdog timeout finished playback after ${maxDurationMs}ms`);
          finish();
        }
      }, maxDurationMs);

      utterance.onstart = () => {
        hasStarted = true;
        clearTimeout(startWatchdog);
        console.log(`[TTS START] gen #${options.generationId || 0} voice="${voice?.name || 'default'}" text="${cleanText.slice(0, 35)}..."`);
        options.onStart?.();
      };

      utterance.onend = () => {
        finish();
      };

      utterance.onerror = (e) => {
        if (e.error === 'interrupted' || e.error === 'canceled') {
          // Expected cancellation (barge-in / stop)
          finish(true);
        } else {
          console.warn(`[TTS ERROR] Genuine speech error event: ${e.error}`);
          fail(new Error(`SpeechSynthesis error: ${e.error}`));
        }
      };

      utterance.onpause = () => {
        console.log('[TTS DEBUG] utterance.onpause: calling resume');
        window.speechSynthesis.resume();
      };

      try {
        console.log('[TTS DEBUG] beforeSpeak=', {
          speaking: window.speechSynthesis.speaking,
          pending: window.speechSynthesis.pending,
          paused: window.speechSynthesis.paused,
          voicesCount: this.getVoices().length
        });
        console.log('[VOICE TRACE] TTS SPEAK calling window.speechSynthesis.speak(utterance)');
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        fail(err);
      }
    });
  }

  public stop(): void {
    if (this.isAvailable()) {
      try {
        console.log('[TTS DEBUG] stop() calling window.speechSynthesis.cancel()');
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    const pending = Array.from(this.activeFinishCallbacks);
    this.activeFinishCallbacks.clear();
    pending.forEach((cb) => {
      try {
        cb();
      } catch (e) {}
    });
    activeUtterancesSet.clear();
  }
}

export const defaultTTSProvider = new BrowserTTSProvider();
