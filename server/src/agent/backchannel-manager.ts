import { LanguageMode } from '../state/types.js';

export class BackchannelManager {
  private lastBackchannelTimestamp = 0;
  private continuousSpeechStartTimestamp = 0;
  private readonly minIntervalMs = 8000; // Minimum 8 seconds between backchannels
  private readonly maxIntervalMs = 15000;

  private static ENGLISH_BACKCHANNELS = [
    'Hmm.',
    'Yeah.',
    'Right.',
    'Mm-hmm.',
    'Oh, okay.',
    'Totally.',
    'Gotcha.'
  ];

  private static HINGLISH_BACKCHANNELS = [
    'Haan.',
    'Achha.',
    'Sahi hai.',
    'Hmm theek hai.',
    'Arre haan.',
    'Samajh raha hoon.'
  ];

  public onUserSpeechStarted(): void {
    if (this.continuousSpeechStartTimestamp === 0) {
      this.continuousSpeechStartTimestamp = Date.now();
    }
  }

  public onUserSpeechEnded(): void {
    this.continuousSpeechStartTimestamp = 0;
  }

  /**
   * Determine whether a backchannel should be uttered at this micro-pause.
   */
  public shouldBackchannel(pauseDurationMs: number): boolean {
    const now = Date.now();
    if (this.continuousSpeechStartTimestamp === 0) {
      return false;
    }

    const speakingDuration = now - this.continuousSpeechStartTimestamp;
    const timeSinceLast = now - this.lastBackchannelTimestamp;

    // Must have spoken for at least minIntervalMs and pause must be a brief micro-pause (150-350ms)
    if (speakingDuration >= this.minIntervalMs && timeSinceLast >= this.minIntervalMs && pauseDurationMs >= 150 && pauseDurationMs <= 400) {
      return true;
    }

    return false;
  }

  /**
   * Get an appropriate lightweight acknowledgement phrase.
   */
  public getBackchannelPhrase(languageMode: LanguageMode): string {
    this.lastBackchannelTimestamp = Date.now();
    const list = languageMode === 'hinglish' || languageMode === 'hindi'
      ? BackchannelManager.HINGLISH_BACKCHANNELS
      : BackchannelManager.ENGLISH_BACKCHANNELS;

    const randomIndex = Math.floor(Math.random() * list.length);
    return list[randomIndex];
  }
}
