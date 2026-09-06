"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { getSharedAudioContext, resumeSharedAudioContext } from '../utils/audio-context';
import { VoiceProsody } from '../types';

export interface AudioStreamOptions {
  isAgentSpeaking?: boolean;
  onSpeechStart?: () => void;
  onInterimTranscript?: (interimText: string) => void;
  onSpeechEnd?: (finalTranscript: string, durationMs: number, prosody?: VoiceProsody) => void;
  onInterruptionCandidate?: (text: string, durationMs: number) => void;
  onAudioLevel?: (rms: number) => void;
}

export function useAudioStream(options: AudioStreamOptions = {}) {
  const [isMicActive, setIsMicActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const streamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  const isExplicitlyActiveRef = useRef<boolean>(false);
  const isRecognitionRunningRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const speechStartTimeRef = useRef<number>(0);
  const currentInterimRef = useRef<string>('');
  const lastFinalizedTranscriptRef = useRef<string>('');
  const lastFinalizedTimeRef = useRef<number>(0);
  const healthWatchdogRef = useRef<any>(null);
  const restartTimeoutRef = useRef<any>(null);
  const lastErrorRef = useRef<string>('');

  // Acoustic prosody analysis state
  const energySamplesRef = useRef<number[]>([]);
  const peakEnergyRef = useRef<number>(0);
  const zcrSamplesRef = useRef<number[]>([]);

  /**
   * Helper to safely dispatch a finalized turn once with calculated audio prosody
   */
  const dispatchFinalTurn = useCallback((rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    // Deduplication check: ignore normalized identical transcript within 2 seconds
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    const now = Date.now();
    if (
      normalized === lastFinalizedTranscriptRef.current &&
      now - lastFinalizedTimeRef.current < 2000
    ) {
      console.log('[VOICE] duplicate transcript ignored:', text);
      return;
    }

    lastFinalizedTranscriptRef.current = normalized;
    lastFinalizedTimeRef.current = now;
    const durationMs = Math.max(250, now - (speechStartTimeRef.current || now));

    // Calculate prosody stats
    const samples = energySamplesRef.current;
    const avgEnergy = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : 0.4;
    const peakEnergy = peakEnergyRef.current || avgEnergy;
    const zcrSamples = zcrSamplesRef.current;
    const pitchVariation = zcrSamples.length > 0
      ? Math.min(1.0, zcrSamples.reduce((a, b) => a + b, 0) / zcrSamples.length)
      : 0.5;

    // Estimate speaking rate: words per second
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const wordsPerSec = durationMs > 0 ? (wordCount / (durationMs / 1000)) : 2.5;
    let speakingRate: 'slow' | 'normal' | 'fast' | 'rushed' = 'normal';
    if (wordsPerSec < 1.8) speakingRate = 'slow';
    else if (wordsPerSec > 4.2) speakingRate = 'rushed';
    else if (wordsPerSec > 3.0) speakingRate = 'fast';

    const voiceProsody: VoiceProsody = {
      avgEnergy: Number(avgEnergy.toFixed(3)),
      peakEnergy: Number(peakEnergy.toFixed(3)),
      pitchVariation: Number(pitchVariation.toFixed(3)),
      speakingRate,
      durationMs
    };

    console.log(`[VOICE] final transcript: "${text}" (${durationMs}ms) | Prosody:`, voiceProsody);
    console.log(`[VOICE] speech ended`);
    optionsRef.current.onSpeechEnd?.(text, durationMs, voiceProsody);

    // Reset speech tracking & prosody buffers
    currentInterimRef.current = '';
    isSpeakingRef.current = false;
    speechStartTimeRef.current = 0;
    energySamplesRef.current = [];
    peakEnergyRef.current = 0;
    zcrSamplesRef.current = [];
  }, []);

  /**
   * Controlled safe recognition starter
   */
  const restartListeningIfNeeded = useCallback(() => {
    if (
      typeof window === 'undefined' ||
      !isExplicitlyActiveRef.current ||
      !recognitionRef.current ||
      isRecognitionRunningRef.current
    ) {
      return;
    }

    try {
      console.log('[VOICE] restarting recognition');
      recognitionRef.current.start();
      isRecognitionRunningRef.current = true;
    } catch (err: any) {
      if (err?.name === 'InvalidStateError' || err?.message?.includes('already started')) {
        isRecognitionRunningRef.current = true;
      } else {
        console.warn('[VOICE] restart listening warning:', err?.message || err);
      }
    }
  }, []);

  /**
   * Start microphone stream and speech recognition
   */
  const startMic = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      isExplicitlyActiveRef.current = true;
      await resumeSharedAudioContext();
      const ctx = getSharedAudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;
      console.log('[VOICE] mic started');

      if (ctx) {
        try {
          const source = ctx.createMediaStreamSource(stream);
          sourceNodeRef.current = source;
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);
          analyserRef.current = analyser;

          // Audio level & prosody monitoring loop
          const bufferLength = analyser.frequencyBinCount;
          const freqDataArray = new Uint8Array(bufferLength);
          const timeDataArray = new Uint8Array(bufferLength);

          const monitorAudio = () => {
            if (!analyserRef.current || ctx.state !== 'running' || !isExplicitlyActiveRef.current) {
              animationFrameRef.current = requestAnimationFrame(monitorAudio);
              return;
            }

            try {
              analyserRef.current.getByteFrequencyData(freqDataArray);
              analyserRef.current.getByteTimeDomainData(timeDataArray);

              let sum = 0;
              let zeroCrossings = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += freqDataArray[i];
                if (i > 0 && ((timeDataArray[i] >= 128 && timeDataArray[i - 1] < 128) || (timeDataArray[i] < 128 && timeDataArray[i - 1] >= 128))) {
                  zeroCrossings++;
                }
              }

              const avg = sum / bufferLength;
              const normalized = Math.min(1, avg / 128);
              setAudioLevel(normalized);
              optionsRef.current.onAudioLevel?.(normalized);

              // Record acoustic samples during speech turn
              if (isSpeakingRef.current) {
                energySamplesRef.current.push(normalized);
                if (normalized > peakEnergyRef.current) {
                  peakEnergyRef.current = normalized;
                }
                const zcr = Math.min(1.0, zeroCrossings / (bufferLength / 2));
                zcrSamplesRef.current.push(zcr);
              }
            } catch (err) {}

            animationFrameRef.current = requestAnimationFrame(monitorAudio);
          };
          monitorAudio();
        } catch (audioErr) {
          console.warn('[VOICE] WebAudio analyser warning:', audioErr);
        }
      }

      // Setup Web Speech Recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {}
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-IN';

        recognition.onstart = () => {
          console.log('[VOICE] recognition started');
          isRecognitionRunningRef.current = true;
          setIsMicActive(true);
        };

        recognition.onspeechstart = () => {
          console.log('[VOICE] speech started');
          speechStartTimeRef.current = Date.now();
          isSpeakingRef.current = true;
          energySamplesRef.current = [];
          peakEnergyRef.current = 0;
          zcrSamplesRef.current = [];
          optionsRef.current.onSpeechStart?.();
        };

        recognition.onresult = (event: any) => {
          let accumulatedFinalText = '';
          let accumulatedInterimText = '';

          // Iterate across all results from event.resultIndex
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const transcript = result[0]?.transcript || '';

            if (result.isFinal) {
              accumulatedFinalText += transcript;
            } else {
              accumulatedInterimText += transcript;
            }
          }

          const cleanFinal = accumulatedFinalText.trim();
          const cleanInterim = accumulatedInterimText.trim();

          if (!isSpeakingRef.current || speechStartTimeRef.current === 0) {
            isSpeakingRef.current = true;
            speechStartTimeRef.current = Date.now();
            optionsRef.current.onSpeechStart?.();
          }

          const durationMs = Date.now() - speechStartTimeRef.current;

          // Barge-in check while agent is speaking (stops TTS playback immediately on user voice)
          if (optionsRef.current.isAgentSpeaking && (cleanFinal || cleanInterim)) {
            optionsRef.current.onInterruptionCandidate?.(cleanFinal || cleanInterim, durationMs);
          }

          // 1. FINAL RESULT (result.isFinal === true)
          // This is the ONLY condition that sends text to handleUserMessage / onSpeechEnd
          if (cleanFinal.length > 0) {
            currentInterimRef.current = '';
            optionsRef.current.onInterimTranscript?.('');
            dispatchFinalTurn(cleanFinal);
            return;
          }

          // 2. INTERIM RESULT (result.isFinal === false)
          // STRICTLY UI PREVIEW ONLY. NEVER calls dispatchFinalTurn. NEVER triggers Gemini.
          if (cleanInterim.length > 0) {
            currentInterimRef.current = cleanInterim;
            optionsRef.current.onInterimTranscript?.(cleanInterim);
          }
        };

        recognition.onspeechend = () => {
          // Do NOT convert interim transcript into a final turn.
          isSpeakingRef.current = false;
        };

        recognition.onerror = (event: any) => {
          const errorType = event.error;
          lastErrorRef.current = errorType;
          if (errorType === 'no-speech' || errorType === 'aborted') {
            // Harmless transient silence/abort events
          } else if (errorType === 'not-allowed') {
            console.error('[VOICE] Microphone permission denied');
            setIsMicActive(false);
            isExplicitlyActiveRef.current = false;
          } else {
            console.log(`[VOICE] recognition error: ${errorType}`);
          }
        };

        recognition.onend = () => {
          isRecognitionRunningRef.current = false;
          currentInterimRef.current = '';
          optionsRef.current.onInterimTranscript?.('');

          if (isExplicitlyActiveRef.current && streamRef.current) {
            if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
            // If ended due to silence (no-speech), apply a calm 500ms backoff rather than instant restart storm
            const delay = lastErrorRef.current === 'no-speech' ? 500 : 150;
            lastErrorRef.current = '';
            restartTimeoutRef.current = setTimeout(() => {
              restartListeningIfNeeded();
            }, delay);
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
          isRecognitionRunningRef.current = true;
        } catch (startErr) {
          console.warn('[VOICE] initial start warning:', startErr);
        }
      }

      // Health Watchdog: recover recognition if dropped while active
      if (healthWatchdogRef.current) clearInterval(healthWatchdogRef.current);
      healthWatchdogRef.current = setInterval(() => {
        if (
          isExplicitlyActiveRef.current &&
          streamRef.current &&
          !isRecognitionRunningRef.current &&
          !optionsRef.current.isAgentSpeaking
        ) {
          restartListeningIfNeeded();
        }
      }, 2000);

      setIsMicActive(true);
    } catch (err) {
      console.error('[VOICE] Failed to access microphone:', err);
      setIsMicActive(false);
      isExplicitlyActiveRef.current = false;
    }
  }, [dispatchFinalTurn, restartListeningIfNeeded]);

  /**
   * Stop microphone and recognition cleanly
   */
  const stopMic = useCallback(() => {
    console.log('[VOICE] stopped');
    isExplicitlyActiveRef.current = false;
    isRecognitionRunningRef.current = false;

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (healthWatchdogRef.current) {
      clearInterval(healthWatchdogRef.current);
      healthWatchdogRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch (e) {}
      sourceNodeRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    analyserRef.current = null;
    setIsMicActive(false);
    setAudioLevel(0);
    isSpeakingRef.current = false;
    currentInterimRef.current = '';
    speechStartTimeRef.current = 0;
    energySamplesRef.current = [];
    peakEnergyRef.current = 0;
    zcrSamplesRef.current = [];
  }, []);

  /**
   * Toggle mute
   */
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        resumeSharedAudioContext();
        if (
          isExplicitlyActiveRef.current &&
          streamRef.current &&
          !isRecognitionRunningRef.current &&
          !optionsRef.current.isAgentSpeaking
        ) {
          console.log('[VOICE] Tab became visible, recovering recognition...');
          restartListeningIfNeeded();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      stopMic();
    };
  }, [restartListeningIfNeeded, stopMic]);

  return {
    isMicActive,
    isMuted,
    audioLevel,
    startMic,
    stopMic,
    toggleMute,
    restartListeningIfNeeded,
    analyser: analyserRef.current
  };
}
