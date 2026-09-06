"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ConversationState,
  ConversationTurn,
  TurnMetrics,
  InterruptionEvent,
  PersonaConfig,
  TopicItem,
  MemoryFact,
  ReminderItem,
  VoiceProsody
} from '../types';
import { useTTSPlayer } from './useTTSPlayer';

// Regular expression for pure stop commands (deterministic local interception)
const PURE_STOP_REGEX = /^(?:stop|stop stop|stop it|stop please|please stop|okay stop|ok stop|no stop|wait stop|bas stop|yeah stop|yes stop|okay okay stop|just stop|stop now|stop talking|stop speaking|wait|wait wait|wait a minute|wait a sec|wait a second|wait please|just wait|hold on|hold on a second|hold on a sec|hold up|bas|bas karo|bas bas|bas bas karo|bas abhi|ruk|ruko|ruk ja|ruk jao|ruko ruko|ruko ek second|ruko zara|rukna|ruko please|ek second|one second|1 second|one sec|1 sec|ek minute|one minute|1 minute|pause|pause it|pause please|don't continue|dont continue|do not continue|stop continuing|that's enough|thats enough|that is enough|enough|enough now|it's enough|its enough|shut up|chup|chup raho|chup ho jao|i don't want to hear this|dont want to hear this|i don't want to listen|dont want to listen|don't want to hear|talk talk|top top)[.!,?]?$/i;

// Regular expression to extract stop prefix from a combined request: "Stop. Tell me about JavaScript."
const STOP_PREFIX_REGEX = /^(?:stop|stop stop|okay stop|ok stop|please stop|stop please|wait|wait wait|hold on|hold up|pause|bas|bas bas|bas karo|ruk|ruko|ruko ruko|enough|that's enough|thats enough|shut up|ek second|one second|1 second|ek minute|one minute|dont continue|don't continue|stop talking)[.,!?:;\s\-]+(.+)$/i;

export function useVoiceAgent() {
  const [isConnected, setIsConnected] = useState(false);
  const [state, setState] = useState<ConversationState>('IDLE');
  const [activePersona, setActivePersona] = useState<PersonaConfig>({
    name: 'Ayra',
    trait: 'swati_companion',
    description: 'A friendly, expressive, thoughtful conversational companion inspired by Swati’s natural communication style.',
    speechStyle: 'Natural Indian conversational English with occasional organic expressions (haan, acha, arre, yaar, dekho), user-first empathy, talkative and engaging.',
    fillers: ['actually', 'honestly', 'you know'],
    hinglishFillers: ['haan', 'arre yaar', 'dekho', 'sahi hai'],
    tonePreferences: 'Warm, thoughtful, expressive, approachable, friendly.'
  });

  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [currentTopic, setCurrentTopic] = useState<TopicItem | null>(null);
  const [topicStack, setTopicStack] = useState<TopicItem[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<TurnMetrics[]>([]);
  const [interruptionLogs, setInterruptionLogs] = useState<InterruptionEvent[]>([]);
  const [memories, setMemories] = useState<{ facts: MemoryFact[]; reminders: ReminderItem[] }>({
    facts: [],
    reminders: []
  });
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [activeToolFiller, setActiveToolFiller] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const isUnmountedRef = useRef(false);
  const reconnectTimeoutRef = useRef<any>(null);
  const generationIdRef = useRef<number>(0);

  const stateRef = useRef<ConversationState>(state);
  stateRef.current = state;

  // Hook up TTS Player
  const {
    isPlaying,
    enqueueAudioChunk,
    stopAudioPlayback,
    resetGeneration,
    analyser: ttsAnalyser,
    getAudioContext
  } = useTTSPlayer({
    onPlaybackStart: () => {
      console.log('[VOICE TRACE] TTS ONSTART -> AGENT_SPEAKING');
      setState('AGENT_SPEAKING');
    },
    onPlaybackEnd: () => {
      console.log('[VOICE TRACE] TTS ONEND -> LISTENING');
      setState((prev) => (prev === 'AGENT_SPEAKING' ? 'LISTENING' : prev));
    }
  });

  const enqueueAudioChunkRef = useRef(enqueueAudioChunk);
  enqueueAudioChunkRef.current = enqueueAudioChunk;

  const stopAudioPlaybackRef = useRef(stopAudioPlayback);
  stopAudioPlaybackRef.current = stopAudioPlayback;

  const resetGenerationRef = useRef(resetGeneration);
  resetGenerationRef.current = resetGeneration;

  /**
   * Connect WebSocket to backend server (Stable single active socket)
   */
  const connectWebSocket = useCallback(() => {
    if (typeof window === 'undefined' || isUnmountedRef.current) return;
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isUnmountedRef.current) {
          ws.close();
          return;
        }
        console.log('[WS CONNECTED] Connected to Voice Server at', wsUrl);
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          console.log(`[VOICE TRACE] WS RECEIVE: type="${type}"`);

          switch (type) {
            case 'INIT_SYNC':
              if (payload.state) setState(payload.state);
              if (payload.persona) setActivePersona(payload.persona);
              if (payload.currentTopic) setCurrentTopic(payload.currentTopic);
              if (payload.topicStack) setTopicStack(payload.topicStack);
              if (payload.memories) {
                setMemories({
                  facts: payload.memories.longTermFacts || [],
                  reminders: payload.reminders || []
                });
              }
              if (payload.interruptionLogs) setInterruptionLogs(payload.interruptionLogs);
              break;

            case 'STATE_CHANGE':
              // Generation guard: ignore state changes from superseded generation
              if (payload.generationId && payload.generationId < generationIdRef.current) {
                console.log(`[TTS STALE] Ignoring state change for older generation #${payload.generationId}`);
                break;
              }
              console.log(`[VOICE] state transition: ${stateRef.current} -> ${payload.toState} (${payload.trigger})`);
              
              // Only transition to AGENT_SPEAKING if TTS actually started (or transition other states directly)
              if (payload.toState === 'AGENT_SPEAKING') {
                setState((prev) => (prev === 'IDLE' ? 'PROCESSING' : prev));
              } else {
                setState(payload.toState);
              }
              
              if (payload.metadata?.topic) {
                setCurrentTopic(payload.metadata.topic);
              }
              if (payload.generationId) {
                generationIdRef.current = Math.max(generationIdRef.current, payload.generationId);
              }
              break;

            case 'AGENT_SPEECH_CHUNK': {
              const isAccepted = !payload.generationId || payload.generationId >= generationIdRef.current;
              console.log(`[TTS GENERATION] received=${payload.generationId || 0} current=${generationIdRef.current} accepted=${isAccepted} reason="${isAccepted ? 'valid generation' : 'stale generation'}"`);
              
              // Stale response protection: drop chunks from prior invalidated generations
              if (!isAccepted) {
                console.log(
                  `[TTS STALE] Stale agent chunk dropped: gen #${payload.generationId} < active #${generationIdRef.current}`
                );
                break;
              }
              console.log(`[VOICE TRACE] AGENT CHUNK: "${payload.text.slice(0, 35)}..."`);
              console.log(`[VOICE] receiving agent chunk: "${payload.text.slice(0, 30)}..."`);
              if (payload.isFiller) {
                setActiveToolFiller(payload.text);
              }
              enqueueAudioChunkRef.current(payload);
              break;
            }

            case 'RESPONSE_END':
              if (payload.generationId && payload.generationId < generationIdRef.current) {
                console.log(`[TTS STALE] Stale RESPONSE_END ignored: gen #${payload.generationId}`);
                break;
              }
              console.log(`[VOICE] receiving agent final for turn ${payload.turnId}`);
              break;

            case 'CANCEL_AUDIO':
              if (payload.generationId && payload.generationId < generationIdRef.current) {
                console.log(`[TTS STALE] Stale CANCEL_AUDIO ignored: gen #${payload.generationId} < current #${generationIdRef.current}`);
                break;
              }
              console.log(`[VOICE TRACE] TTS CANCEL: cancelling audio playback (${payload.reason})`);
              console.log(`[VOICE] interrupted: cancelling audio playback (${payload.reason})`);
              stopAudioPlaybackRef.current();
              setActiveToolFiller(null);
              break;

            case 'TRANSCRIPT_TURN':
              setTurns((prev) => [...prev, payload]);
              break;

            case 'METRICS_UPDATE':
              setMetricsHistory((prev) => [...prev.slice(-20), payload]);
              break;

            case 'INTERRUPTION_EVENT':
              setInterruptionLogs((prev) => [payload, ...prev.slice(0, 30)]);
              break;

            case 'PERSONA_CHANGED':
              setActivePersona(payload);
              break;

            case 'TOOL_IN_FLIGHT':
              setActiveToolFiller(payload.filler);
              break;

            case 'TOOL_COMPLETED':
              setActiveToolFiller(null);
              break;

            case 'MEMORY_UPDATED':
              setMemories({
                facts: payload.longTermFacts || [],
                reminders: payload.reminders || []
              });
              break;

            default:
              break;
          }
        } catch (e) {
          console.error('[WebSocket Client] Error parsing incoming message:', e);
        }
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        socketRef.current = null;
        console.log(`[WS CLOSED] code=${event.code} reason="${event.reason}" wasClean=${event.wasClean}`);
        if (!isUnmountedRef.current) {
          console.log('[WS DISCONNECTED] Disconnected, scheduling reconnect...');
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, 2000);
        }
      };

      ws.onerror = (err) => {
        console.warn('[WebSocket Client] Connection error event:', err);
      };
    } catch (e) {
      console.error('[WebSocket Client] Socket initialization error:', e);
    }
  }, []);

  useEffect(() => {
    isUnmountedRef.current = false;
    connectWebSocket();

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible' && !isUnmountedRef.current) {
        if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED || socketRef.current.readyState === WebSocket.CLOSING) {
          console.log('[WS] Tab became visible, checking and recovering WebSocket connection...');
          connectWebSocket();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isUnmountedRef.current = true;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connectWebSocket]);

  /**
   * Helper to send JSON messages
   */
  const send = useCallback((type: string, payload: any = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log(`[VOICE TRACE] WS SEND: type="${type}"`);
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  /**
   * Start Call Session
   */
  const startCall = useCallback(() => {
    getAudioContext();
    send('START_CALL', { personaName: activePersona.name, userId: 'default-user' });
    setState('LISTENING');
  }, [activePersona.name, getAudioContext, send]);

  /**
   * End Call Session
   */
  const endCall = useCallback(() => {
    stopAudioPlaybackRef.current();
    send('END_CALL');
    setState('IDLE');
  }, [send]);

  const lastSentTranscriptRef = useRef('');
  const lastSentTimeRef = useRef(0);

  /**
   * Send Final User Speech
   * Handles:
   * 1. STT error normalization
   * 2. Pure STOP command local interception (STOP_COMMAND -> never reaches Gemini)
   * 3. STOP + NEW REQUEST extraction ("Stop. Tell me about JavaScript." -> sends clean new request)
   * 4. Multi-tier deduplication & sentence extension handling
   * 5. Generation ID invalidation
   */
  const sendUserSpeech = useCallback(
    (text: string, durationMs?: number, isInterruption = false, prosody?: VoiceProsody) => {
      let clean = text.trim();
      if (!clean) return;

      // STT error normalization for common acoustic misrecognitions
      if (/^(talk talk|top top|stop talk)$/i.test(clean)) {
        clean = 'stop stop';
      }

      const now = Date.now();

      // Deduplication: ignore identical transcript within 2000ms
      if (
        clean.toLowerCase() === lastSentTranscriptRef.current.toLowerCase() &&
        now - lastSentTimeRef.current < 2000
      ) {
        console.log('[TURN DUPLICATE IGNORED] (Client):', clean);
        return;
      }

      lastSentTranscriptRef.current = clean;
      lastSentTimeRef.current = now;

      // Invalidate current generation immediately on client
      generationIdRef.current += 1;
      const genId = generationIdRef.current;
      resetGenerationRef.current(genId);

      // Immediately cancel any playing TTS & audio playback
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopAudioPlaybackRef.current();
      setActiveToolFiller(null);
      setInterimTranscript('');

      // CASE 1: Pure Hard STOP Command
      // Must NEVER reach Gemini as a normal conversational turn!
      if (PURE_STOP_REGEX.test(clean)) {
        console.log(`[COMMAND] Pure STOP command intercepted: "${clean}" -> sending STOP_COMMAND`);
        setState('LISTENING');
        send('STOP_COMMAND', {
          text: clean,
          generationId: genId
        });
        return;
      }

      // CASE 2: STOP + NEW REQUEST ("Stop. Tell me about JavaScript.")
      const stopPrefixMatch = clean.match(STOP_PREFIX_REGEX);
      let targetText = clean;
      let effectiveInterruption = isInterruption;

      if (stopPrefixMatch && stopPrefixMatch[1]) {
        const extractedNewRequest = stopPrefixMatch[1].trim();
        if (extractedNewRequest && !PURE_STOP_REGEX.test(extractedNewRequest)) {
          console.log(`[COMMAND] STOP + NEW REQUEST extracted: "${clean}" -> "${extractedNewRequest}"`);
          targetText = extractedNewRequest;
          effectiveInterruption = true;
        }
      }

      console.log(`[TURN SENT] text: "${targetText}" (gen #${genId}) | isInterruption: ${effectiveInterruption}`);
      send('USER_SPEECH_FINAL', {
        text: targetText,
        durationMs: durationMs || 300,
        isInterruption: effectiveInterruption,
        generationId: genId,
        prosody
      });
    },
    [send]
  );

  /**
   * Check Interruption (Barge-in Candidate)
   */
  const checkInterruption = useCallback(
    (text: string, durationMs: number) => {
      // Barge-in: cut audio playback immediately on user voice
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopAudioPlaybackRef.current();
      setActiveToolFiller(null);
      send('CHECK_INTERRUPTION', { text, durationMs });
    },
    [send]
  );

  /**
   * Switch Active Persona
   */
  const switchPersona = useCallback(
    (personaName: string) => {
      send('SWITCH_PERSONA', { personaName });
    },
    [send]
  );

  /**
   * Trigger Backchannel
   */
  const triggerBackchannel = useCallback(
    (languageMode = 'english') => {
      send('TRIGGER_BACKCHANNEL', { languageMode });
    },
    [send]
  );

  /**
   * Clear Transcript
   */
  const clearTranscript = useCallback(() => {
    setTurns([]);
  }, []);

  return {
    isConnected,
    state,
    activePersona,
    turns,
    interimTranscript,
    setInterimTranscript,
    currentTopic,
    topicStack,
    metricsHistory,
    interruptionLogs,
    memories,
    activeToolFiller,
    isPlayingTTS: isPlaying,
    ttsAnalyser,
    startCall,
    endCall,
    sendUserSpeech,
    checkInterruption,
    switchPersona,
    triggerBackchannel,
    clearTranscript,
    stopAudioPlayback
  };
}
