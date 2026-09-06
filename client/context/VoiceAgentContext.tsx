"use client";

import React, { createContext, useContext } from 'react';
import { useVoiceAgent } from '../hooks/useVoiceAgent';
import { useAudioStream } from '../hooks/useAudioStream';

type VoiceAgentContextType = ReturnType<typeof useVoiceAgent> & {
  isMicActive: boolean;
  isMuted: boolean;
  audioLevel: number;
  startMic: () => Promise<void>;
  stopMic: () => void;
  toggleMute: () => void;
  micAnalyser: AnalyserNode | null;
};

const VoiceAgentContext = createContext<VoiceAgentContextType | null>(null);

export const VoiceAgentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const voiceAgent = useVoiceAgent();

  const audioStream = useAudioStream({
    isAgentSpeaking: voiceAgent.state === 'AGENT_SPEAKING',
    onSpeechStart: () => {
      if (voiceAgent.state === 'AGENT_SPEAKING') {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        voiceAgent.stopAudioPlayback();
      }
    },
    onInterimTranscript: (interimText) => {
      voiceAgent.setInterimTranscript(interimText);
    },
    onSpeechEnd: (transcript, durationMs, prosody) => {
      voiceAgent.sendUserSpeech(transcript, durationMs, false, prosody);
    },
    onInterruptionCandidate: (interimText, durationMs) => {
      if (voiceAgent.state === 'AGENT_SPEAKING') {
        voiceAgent.checkInterruption(interimText, durationMs);
      }
    }
  });

  const value: VoiceAgentContextType = {
    ...voiceAgent,
    isMicActive: audioStream.isMicActive,
    isMuted: audioStream.isMuted,
    audioLevel: audioStream.audioLevel,
    startMic: audioStream.startMic,
    stopMic: audioStream.stopMic,
    toggleMute: audioStream.toggleMute,
    micAnalyser: audioStream.analyser
  };

  return <VoiceAgentContext.Provider value={value}>{children}</VoiceAgentContext.Provider>;
};

export function useVoiceContext(): VoiceAgentContextType {
  const context = useContext(VoiceAgentContext);
  if (!context) {
    throw new Error('useVoiceContext must be used within a VoiceAgentProvider');
  }
  return context;
}
