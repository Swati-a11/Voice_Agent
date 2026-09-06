"use client";

import React from 'react';
import { Activity } from 'lucide-react';
import { useVoiceContext } from '../../context/VoiceAgentContext';
import { LatencyDashboard } from '../../components/LatencyDashboard';
import { CallControls } from '../../components/CallControls';
import { Waveform } from '../../components/Waveform';

export default function MetricsPage() {
  const {
    state,
    isConnected,
    isMicActive,
    isMuted,
    metricsHistory,
    interruptionLogs,
    ttsAnalyser,
    micAnalyser,
    startCall,
    endCall,
    toggleMute,
    startMic,
    stopMic,
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
      {/* Top Header */}
      <div className="bg-[#0d091e]/80 backdrop-blur-xl p-6 rounded-2xl border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Activity className="text-purple-400" size={24} />
            <span>Voice Speed &amp; Performance</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time tracking of speech recognition, Gemini AI brain response, audio synthesis, and instant barge-in cut-off speed.
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

      {/* Latency Dashboard Component */}
      <LatencyDashboard
        metrics={metricsHistory}
        interruptionLogs={interruptionLogs}
      />
    </div>
  );
}
