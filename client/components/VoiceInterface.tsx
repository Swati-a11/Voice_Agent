"use client";

import React, { useState } from 'react';
import { MessageSquare, Database, Activity, Cpu, Sparkles, User, Bot, Trash2, Send, Clock, Target, Plus, BookOpen, Briefcase, Heart } from 'lucide-react';
import { useVoiceContext } from '../context/VoiceAgentContext';
import { VisualizerOrb } from './VisualizerOrb';
import { Waveform } from './Waveform';
import { CallControls } from './CallControls';
import { ConversationTranscript } from './ConversationTranscript';
import { MemoryInspector } from './MemoryInspector';
import { LatencyDashboard } from './LatencyDashboard';
import { TopicStackViewer } from './TopicStackViewer';

type BottomTab = 'transcript' | 'memory' | 'performance';

export const VoiceInterface: React.FC = () => {
  const {
    isConnected,
    state,
    turns,
    currentTopic,
    topicStack,
    metricsHistory,
    interruptionLogs,
    memories,
    activeToolFiller,
    isPlayingTTS,
    ttsAnalyser,
    startCall,
    endCall,
    sendUserSpeech,
    clearTranscript,
    isMicActive,
    isMuted,
    audioLevel,
    startMic,
    stopMic,
    toggleMute,
    micAnalyser,
  } = useVoiceContext();

  const [activeTab, setActiveTab] = useState<BottomTab>('transcript');

  const handleStartCall = () => {
    startMic();
    startCall();
  };

  const handleEndCall = () => {
    stopMic();
    endCall();
  };

  const getStateBadge = () => {
    switch (state) {
      case 'LISTENING':
        return <span className="badge badge-listening animate-pulse">● Listening...</span>;
      case 'USER_SPEAKING':
        return <span className="badge badge-listening">● You are speaking</span>;
      case 'PROCESSING':
        return <span className="badge badge-processing animate-spin">⟳ Thinking...</span>;
      case 'AGENT_SPEAKING':
        return <span className="badge badge-speaking">▲ Speaking...</span>;
      case 'INTERRUPTED':
        return <span className="badge badge-interrupted">✕ Interrupted (Listening to you)</span>;
      case 'TOOL_CALLING':
        return <span className="badge badge-tool animate-pulse">⚙ Processing request...</span>;
      case 'IDLE':
      default:
        return <span className="badge bg-white/5 text-slate-400 border border-white/10">● Standby</span>;
    }
  };

  return (
    <div className="flex flex-col items-center justify-between max-w-4xl mx-auto space-y-6 w-full px-2 sm:px-4 pb-12">
      {/* Center Stage: Interactive Orb & Conversation Core */}
      <main className="w-full flex flex-col items-center justify-center my-2 relative">
        {/* Status Pill & Topic */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
          {getStateBadge()}
          {currentTopic && (
            <span className="text-xs px-3 py-1 rounded-full bg-purple-950/40 text-purple-300 border border-purple-500/20 font-medium">
              💬 Topic: {currentTopic.name}
            </span>
          )}
        </div>

        {/* Active Tool / Natural Filler Indicator */}
        {activeToolFiller && (
          <div className="animate-in fade-in slide-in-from-top duration-200 mb-3 px-4 py-1.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs flex items-center gap-2">
            <Sparkles size={13} className="text-indigo-400 animate-spin" />
            <span>&ldquo;{activeToolFiller}&rdquo;</span>
          </div>
        )}

        {/* Visualizer Orb */}
        <div className="relative py-2">
          <VisualizerOrb
            state={state}
            audioLevel={audioLevel}
            isPlaying={isPlayingTTS}
          />
        </div>

        {/* Audio Waveform */}
        <div className="w-full max-w-xs sm:max-w-sm my-1">
          <Waveform
            analyser={state === 'AGENT_SPEAKING' ? ttsAnalyser : micAnalyser}
            state={state}
            isActive={state !== 'IDLE'}
          />
        </div>

        {/* Call Action Controls */}
        <div className="mt-4 w-full max-w-md">
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
      </main>

      {/* Clean Companion Insights Tabs (Transcript, Memory, Speed) */}
      <section className="w-full space-y-3 pt-2">
        {/* Segmented Tab Switcher */}
        <div className="flex items-center justify-center gap-1.5 p-1 rounded-full bg-white/[0.03] border border-white/[0.08] max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('transcript')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'transcript'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <MessageSquare size={13} />
            <span>Chat Transcript ({turns.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('memory')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'memory'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Database size={13} />
            <span>Memory ({memories.facts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('performance')}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'performance'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Activity size={13} />
            <span>Speed Stats</span>
          </button>
        </div>

        {/* Tab 1: Clean Conversation Transcript */}
        {activeTab === 'transcript' && (
          <div className="animate-in fade-in duration-200">
            <ConversationTranscript
              turns={turns}
              isOpen={true}
              onToggle={() => {}}
              onClear={clearTranscript}
              onSendMessage={(text) => sendUserSpeech(text, 350, false)}
            />
          </div>
        )}

        {/* Tab 2: AI Long-Term Memory */}
        {activeTab === 'memory' && (
          <div className="animate-in fade-in duration-200 grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <TopicStackViewer currentTopic={currentTopic} topicStack={topicStack} />
          </div>
        )}

        {/* Tab 3: Performance & Latency Scorecard */}
        {activeTab === 'performance' && (
          <div className="animate-in fade-in duration-200">
            <LatencyDashboard
              metrics={metricsHistory}
              interruptionLogs={interruptionLogs}
              isOpen={true}
              onToggle={() => {}}
            />
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="w-full text-center text-xs text-slate-500 pt-4">
        Truly Human-Like Real-Time Voice Agent • Built with Google Gemini &amp; Web Speech
      </footer>
    </div>
  );
};
