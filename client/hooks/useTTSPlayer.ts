"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { getSharedAudioContext, resumeSharedAudioContext } from '../utils/audio-context';
import { defaultTTSProvider, TTSOptions } from '../services/tts-provider';

export interface TTSChunk {
  text: string;
  phoneticText?: string;
  audioBase64?: string;
  provider?: string;
  isFiller?: boolean;
  sessionId?: number;
  turnId?: string;
  generationId?: number;
  ttsAdjustment?: {
    rate?: number;
    pitch?: number;
    volume?: number;
  };
}

export function useTTSPlayer(options?: { onPlaybackEnd?: () => void; onPlaybackStart?: () => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const playbackSessionRef = useRef<number>(1);
  const activeGenerationIdRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioQueueRef = useRef<TTSChunk[]>([]);
  const isProcessingQueueRef = useRef(false);

  // Initialize Web Audio Context for audio analysis
  const getAudioContext = useCallback(() => {
    const ctx = getSharedAudioContext();
    if (ctx && !analyserRef.current) {
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;
      } catch (err) {
        console.warn('[TTS] Analyser warning:', err);
      }
    }
    resumeSharedAudioContext();
    return { ctx, analyser: analyserRef.current };
  }, []);

  /**
   * Stop audio immediately on interruption / barge-in / stop command (<15ms response).
   */
  const stopAudioPlayback = useCallback(() => {
    playbackSessionRef.current += 1;
    console.log(`[VOICE TRACE] TTS CANCEL: Stopping playback session #${playbackSessionRef.current}`);
    console.log(`[VOICE] stopped (Active session: #${playbackSessionRef.current})`);

    defaultTTSProvider.stop();
    audioQueueRef.current = [];
    isProcessingQueueRef.current = false;
    setIsPlaying(false);
    optionsRef.current?.onPlaybackEnd?.();
  }, []);

  /**
   * Play single chunk using TTS Provider with session and generation validation
   */
  const playBrowserSpeech = useCallback((chunk: TTSChunk, sessionId: number): Promise<void> => {
    return new Promise((resolve) => {
      if (sessionId !== playbackSessionRef.current) {
        console.log(`[VOICE TRACE] TTS QUEUE state: CANCELLED (session #${sessionId} !== current #${playbackSessionRef.current})`);
        resolve();
        return;
      }

      if (
        chunk.generationId &&
        activeGenerationIdRef.current &&
        chunk.generationId < activeGenerationIdRef.current
      ) {
        console.log(`[VOICE TRACE] TTS QUEUE state: CANCELLED (old gen #${chunk.generationId} < current #${activeGenerationIdRef.current})`);
        console.log(`[TTS STALE] Dropping stale playback chunk: gen #${chunk.generationId}`);
        resolve();
        return;
      }

      const text = chunk.phoneticText || chunk.text;
      console.log(`[VOICE TRACE] TTS QUEUE state: QUEUED -> PLAYING (gen #${chunk.generationId || 0}): "${text.slice(0, 30)}..."`);
      const ttsOptions: TTSOptions = {
        rate: chunk.ttsAdjustment?.rate ?? 1.05,
        pitch: chunk.ttsAdjustment?.pitch ?? 1.0,
        volume: chunk.ttsAdjustment?.volume ?? 1.0,
        sessionId,
        turnId: chunk.turnId,
        generationId: chunk.generationId,
        onStart: () => {
          if (sessionId !== playbackSessionRef.current) {
            defaultTTSProvider.stop();
            resolve();
            return;
          }
          console.log('[VOICE TRACE] TTS ONSTART');
          console.log('[VOICE] playback started:', text.slice(0, 35) + (text.length > 35 ? '...' : ''));
          setIsPlaying(true);
          optionsRef.current?.onPlaybackStart?.();
        },
        onEnd: () => {
          console.log('[VOICE TRACE] TTS ONEND');
          console.log(`[VOICE TRACE] TTS QUEUE state: PLAYING -> ENDED (gen #${chunk.generationId || 0})`);
          if (sessionId === playbackSessionRef.current) {
            if (audioQueueRef.current.length === 0) {
              console.log('[VOICE] playback ended');
              setIsPlaying(false);
              optionsRef.current?.onPlaybackEnd?.();
            }
          }
          resolve();
        },
        onError: (err) => {
          console.log('[VOICE TRACE] TTS ONERROR', err?.message || err);
          console.log(`[VOICE TRACE] TTS QUEUE state: PLAYING -> FAILED (gen #${chunk.generationId || 0})`);
          console.warn('[TTS ERROR] Playback error in hook:', err?.message || err);
          if (sessionId === playbackSessionRef.current && audioQueueRef.current.length === 0) {
            setIsPlaying(false);
            optionsRef.current?.onPlaybackEnd?.();
          }
          resolve();
        }
      };

      defaultTTSProvider.speak(text, ttsOptions).then(resolve).catch((e) => {
        console.error('[TTS ERROR] speak rejection caught:', e);
        resolve();
      });
    });
  }, []);

  /**
   * Process incoming audio queue sequentially (Strict FIFO: chunk 1 -> chunk 2 -> chunk 3)
   * Guaranteed never to deadlock or permanently lock isProcessingQueueRef.
   */
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    try {
      while (audioQueueRef.current.length > 0) {
        const currentSession = playbackSessionRef.current;
        const chunk = audioQueueRef.current.shift();
        if (!chunk) break;

        // Session & Generation validity check
        if (chunk.sessionId && chunk.sessionId !== playbackSessionRef.current) {
          console.log(`[TTS STALE] Dropping chunk with old session #${chunk.sessionId}`);
          continue;
        }

        if (
          chunk.generationId &&
          activeGenerationIdRef.current &&
          chunk.generationId < activeGenerationIdRef.current
        ) {
          console.log(`[TTS STALE] Dropping chunk with old generation #${chunk.generationId}`);
          continue;
        }

        const textToSpeak = chunk.phoneticText || chunk.text;
        if (!textToSpeak.trim()) continue;

        try {
          await playBrowserSpeech(chunk, chunk.sessionId || currentSession);
        } catch (err) {
          console.error('[TTS ERROR] Queue playback error:', err);
        }

        // Check if session changed while awaiting speech
        if (playbackSessionRef.current !== currentSession) {
          audioQueueRef.current = [];
          break;
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [playBrowserSpeech]);

  /**
   * Enqueue a chunk for immediate sequential playback
   */
  const enqueueAudioChunk = useCallback((chunk: TTSChunk) => {
    console.log(`[VOICE TRACE] TTS QUEUE chunk received: "${chunk.text.slice(0, 30)}..." (gen #${chunk.generationId || 0})`);
    if (chunk.generationId) {
      if (chunk.generationId < activeGenerationIdRef.current) {
        console.log(`[TTS STALE] Rejected enqueue for old generation #${chunk.generationId}`);
        return;
      }
      activeGenerationIdRef.current = Math.max(activeGenerationIdRef.current, chunk.generationId);
    }

    const chunkWithSession = {
      ...chunk,
      sessionId: chunk.sessionId || playbackSessionRef.current
    };
    audioQueueRef.current.push(chunkWithSession);
    processQueue();
  }, [processQueue]);

  /**
   * Reset active generation tracking on new user turn
   */
  const resetGeneration = useCallback((newGenId: number) => {
    activeGenerationIdRef.current = newGenId;
    defaultTTSProvider.activeGenerationId = newGenId;
  }, []);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  return {
    isPlaying,
    enqueueAudioChunk,
    stopAudioPlayback,
    resetGeneration,
    playbackSession: playbackSessionRef.current,
    analyser: analyserRef.current,
    getAudioContext
  };
}
