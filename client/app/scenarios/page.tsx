"use client";

import React, { useState } from 'react';
import { PlayCircle, MessageSquare } from 'lucide-react';
import { useVoiceContext } from '../../context/VoiceAgentContext';
import { ScenarioSimulator } from '../../components/ScenarioSimulator';
import { ConversationTranscript } from '../../components/ConversationTranscript';
import { CallControls } from '../../components/CallControls';
import { Waveform } from '../../components/Waveform';

export default function ScenariosPage() {
  const {
    state,
    isConnected,
    isMicActive,
    isMuted,
    turns,
    ttsAnalyser,
    micAnalyser,
    startCall,
    endCall,
    toggleMute,
    startMic,
    stopMic,
    sendUserSpeech,
    clearTranscript
  } = useVoiceContext();

  const handleStartCall = () => {
    startMic();
    startCall();
  };

  const handleEndCall = () => {
    stopMic();
    endCall();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 pb-12">
      {/* Top Header Card */}
      <div className="bg-[#0d091e]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <PlayCircle className="text-purple-400" size={24} />
            <span>Interactive Voice Scenarios</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Click any scenario below to test real-time conversations, instant interruptions, and language code-switching.
          </p>
        </div>

        <div className="w-full md:w-auto">
          <CallControls
            state={state}
            isConnected={isConnected}
            isMicActive={isMicActive}
            isMuted={isMuted}
            onStartCall={handleStartCall}
            onEndCall={handleEndCall}
            onToggleMute={toggleMute}
          />
        </div>
      </div>

      <div className="w-full max-w-sm mx-auto">
        <Waveform
          analyser={state === 'AGENT_SPEAKING' ? ttsAnalyser : micAnalyser}
          state={state}
          isActive={state !== 'IDLE'}
        />
      </div>

      {/* Main Scenarios Grid */}
      <div className="space-y-4">
        <ScenarioSimulator
          onRunSpeech={(text, isInterruption) => sendUserSpeech(text, 350, isInterruption)}
        />
      </div>

      {/* Live Conversation Transcript Preview */}
      <div className="pt-2">
        <ConversationTranscript
          turns={turns}
          isOpen={true}
          onClear={clearTranscript}
          onSendMessage={(text) => sendUserSpeech(text, 350, false)}
        />
      </div>
    </div>
  );
}
