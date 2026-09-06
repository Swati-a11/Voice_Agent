/**
 * Shared AudioContext Manager
 * Prevents multiple AudioContext collisions, hardware renderer crashes, and handles browser autoplay policies.
 */

let sharedAudioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  try {
    if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;

      sharedAudioContext = new AudioCtx({
        latencyHint: 'interactive'
      });

      if ('onerror' in sharedAudioContext) {
        (sharedAudioContext as any).onerror = (e: any) => {
          console.warn('[AudioContext] Device/Renderer event:', e);
        };
      }
    }

    if (sharedAudioContext.state === 'suspended') {
      sharedAudioContext.resume().catch(() => {
        // Will resume on next user gesture
      });
    }

    return sharedAudioContext;
  } catch (err) {
    console.warn('[AudioContext] Initialization handled safely:', err);
    return null;
  }
}

export function resumeSharedAudioContext(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (ctx && ctx.state === 'suspended') {
    return ctx.resume().catch((err) => {
      console.warn('[AudioContext] Resume rejected until user gesture:', err);
    });
  }
  return Promise.resolve();
}
