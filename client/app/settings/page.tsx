"use client";

import React from 'react';
import { Database, Sparkles, CheckCircle2, MessageSquare, Volume2 } from 'lucide-react';
import { useVoiceContext } from '../../context/VoiceAgentContext';
import { MemoryInspector } from '../../components/MemoryInspector';
import { PERSONA_OPTIONS } from '../../components/PersonaSwitcher';
import { CallControls } from '../../components/CallControls';
import { Waveform } from '../../components/Waveform';

export default function SettingsPage() {
  const {
    state,
    isConnected,
    isMicActive,
    isMuted,
    activePersona,
    memories,
    switchPersona,
    startCall,
    endCall,
    toggleMute,
    startMic,
    stopMic,
    ttsAnalyser,
    micAnalyser,
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
            <Database className="text-purple-400" size={24} />
            <span>AI Personality &amp; Memory</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Customize your AI companion&rsquo;s personality, conversational tone, and inspect what it remembers across sessions.
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

      {/* Section 1: Choose Persona Grid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Sparkles size={16} className="text-purple-400" />
          <span>Choose AI Persona</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {PERSONA_OPTIONS.map((option) => {
            const isSelected = option.name === activePersona.name;
            const Icon = option.icon;
            return (
              <div
                key={option.name}
                onClick={() => state !== 'AGENT_SPEAKING' && switchPersona(option.name)}
                className={`p-4 rounded-2xl bg-[#0d091e]/80 border transition-all duration-200 flex flex-col justify-between gap-3 cursor-pointer select-none ${
                  isSelected
                    ? 'border-purple-500 bg-purple-950/25 shadow-lg shadow-purple-500/20'
                    : 'border-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl border ${option.color}`}>
                      <Icon size={16} />
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] text-purple-300 font-medium bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30">
                        <CheckCircle2 size={12} />
                        Active
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-white">{option.title}</h3>
                    <p className="text-[11px] text-purple-300/80 font-medium">{option.subtitle}</p>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{option.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Active Persona Details & Cross-Session Memory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Active Persona Details */}
        <div className="bg-[#0d091e]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Volume2 size={16} className="text-purple-400" />
            <span>Active Voice &amp; Language Settings</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Language &amp; Cadence
              </div>
              <div className="text-slate-200 leading-relaxed">
                Natural Indian Conversational English with organic Hinglish touches (70–90% English, 10–30% Hindi words like <span className="text-purple-300 font-mono">haan, acha, arre, yaar, dekho</span>).
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Speaking Persona
              </div>
              <div className="text-slate-200 leading-relaxed">
                {activePersona.speechStyle}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-1">
              <div className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Conversational Tone
              </div>
              <div className="text-slate-200 leading-relaxed">
                {activePersona.tonePreferences}
              </div>
            </div>
          </div>
        </div>

        {/* Long-Term Memory Component */}
        <MemoryInspector
          memories={memories}
          onAddFact={(fact, cat) => {
            fetch('/api/memories/fact', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fact, category: cat })
            }).catch(() => {});
          }}
        />
      </div>
    </div>
  );
}
