"use client";

import React, { useState } from 'react';
import { Play, Sparkles, Zap, MessageSquare, RefreshCw, Volume2, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ScenarioSimulatorProps {
  onRunSpeech: (text: string, isInterruption?: boolean) => void;
  isOpen?: boolean;
}

interface ScenarioItem {
  id: string;
  category: 'conversation' | 'interruption' | 'topic' | 'hinglish' | 'noise';
  title: string;
  description: string;
  text: string;
  isInterruption: boolean;
  tag: string;
  badgeColor: string;
}

const SCENARIOS: ScenarioItem[] = [
  // Natural Conversation
  {
    id: 'story_request',
    category: 'conversation',
    title: 'Ask for an AI Story',
    description: 'Requests a creative short story about artificial intelligence.',
    text: 'I am doing great can you tell me a brief story about AI',
    isInterruption: false,
    tag: 'Storytelling',
    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  },
  {
    id: 'story_reaction',
    category: 'conversation',
    title: 'React to the Story',
    description: 'Gives positive feedback to test contextual memory.',
    text: 'that actually is nice',
    isInterruption: false,
    tag: 'Contextual Reaction',
    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25',
  },
  {
    id: 'return_story',
    category: 'conversation',
    title: 'Return to Previous Story',
    description: 'Resumes an earlier topic from conversational memory.',
    text: 'Going back to that story...',
    isInterruption: false,
    tag: 'Memory Resume',
    badgeColor: 'bg-pink-500/15 text-pink-300 border-pink-500/25',
  },

  // Interruption & Barge-In
  {
    id: 'bargein_joke',
    category: 'interruption',
    title: 'Interrupt with a Joke Request',
    description: 'Cuts off the agent while it is speaking to ask for a joke.',
    text: 'Wait, forget React. Tell me a joke.',
    isInterruption: true,
    tag: 'Instant Barge-In (<35ms)',
    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  },
  {
    id: 'cancel_story_robots',
    category: 'interruption',
    title: 'Cancel Story -> Ask Robots',
    description: 'Instantly cancels in-flight storytelling and shifts to robotics.',
    text: 'actually forget the story tell me about robots',
    isInterruption: true,
    tag: 'Cancellation & Switch',
    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  },

  // Topic Changes & Corrections
  {
    id: 'ask_react',
    category: 'topic',
    title: 'Ask About React',
    description: 'Starts a technical inquiry on React and frontend components.',
    text: 'Tell me about React.',
    isInterruption: false,
    tag: 'Tech Knowledge',
    badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  },
  {
    id: 'switch_python',
    category: 'topic',
    title: 'Change Mind -> Python',
    description: 'Smoothly changes direction to Python programming.',
    text: 'Actually never mind. Explain Python.',
    isInterruption: false,
    tag: 'Topic Transition',
    badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  },
  {
    id: 'correct_javascript',
    category: 'topic',
    title: 'Fact Correction (Java -> JavaScript)',
    description: 'Corrects a slip of the tongue to verify conversational context.',
    text: 'No, I meant JavaScript.',
    isInterruption: false,
    tag: 'Self-Correction',
    badgeColor: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
  },

  // Hinglish & Multi-Language
  {
    id: 'hinglish_hooks',
    category: 'hinglish',
    title: 'Hinglish Question (React Hooks)',
    description: 'Speaks natural conversational Hinglish (Hindi + English).',
    text: 'acha React hooks kya hote hain?',
    isInterruption: false,
    tag: 'Hinglish Code-Switch',
    badgeColor: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  },

  // Noise & Filter
  {
    id: 'cough_filter',
    category: 'noise',
    title: 'Cough / Background Noise Filter',
    description: 'Tests false-trigger suppression so coughing is ignored.',
    text: '[cough]',
    isInterruption: false,
    tag: 'Noise Discrimination',
    badgeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
  },
];

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({ onRunSpeech }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [lastExecutedId, setLastExecutedId] = useState<string | null>(null);

  const filteredScenarios = selectedCategory === 'all'
    ? SCENARIOS
    : SCENARIOS.filter((s) => s.category === selectedCategory);

  const handleRun = (scenario: ScenarioItem) => {
    setLastExecutedId(scenario.id);
    onRunSpeech(scenario.text, scenario.isInterruption);
    setTimeout(() => setLastExecutedId(null), 2500);
  };

  const categories = [
    { id: 'all', label: 'All Scenarios', icon: Sparkles },
    { id: 'conversation', label: '💬 Conversation', icon: MessageSquare },
    { id: 'interruption', label: '⚡ Barge-In', icon: Zap },
    { id: 'topic', label: '🔄 Topic Switches', icon: RefreshCw },
    { id: 'hinglish', label: '🇮🇳 Hinglish', icon: Volume2 },
    { id: 'noise', label: '🛡️ Noise Filter', icon: ShieldCheck },
  ];

  return (
    <div className="w-full space-y-4">
      {/* Category Pills Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCategory === cat.id
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08]'
            }`}
          >
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredScenarios.map((scenario) => {
          const isRunning = lastExecutedId === scenario.id;
          return (
            <div
              key={scenario.id}
              className={`p-4 rounded-2xl bg-[#0d091e]/80 border transition-all duration-200 flex flex-col justify-between gap-3 ${
                isRunning
                  ? 'border-purple-500 bg-purple-950/20 shadow-lg shadow-purple-500/20'
                  : 'border-white/[0.08] hover:border-white/20'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-white">{scenario.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${scenario.badgeColor}`}>
                    {scenario.tag}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{scenario.description}</p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.05]">
                <div className="text-xs text-purple-200/90 font-mono italic truncate max-w-[240px] sm:max-w-[280px]">
                  &ldquo;{scenario.text}&rdquo;
                </div>

                <button
                  type="button"
                  onClick={() => handleRun(scenario)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRunning
                      ? 'bg-emerald-500 text-white'
                      : 'bg-purple-600/30 hover:bg-purple-600 border border-purple-500/40 hover:border-transparent text-purple-200 hover:text-white'
                  }`}
                >
                  {isRunning ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Sent!</span>
                    </>
                  ) : (
                    <>
                      <Play size={11} fill="currentColor" />
                      <span>Simulate</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
