"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, BrainCircuit, Mic, AudioWaveform } from 'lucide-react';
import { ConversationState } from '../../types';

interface AIOrbProps {
  agentState?: ConversationState;
}

export const AIOrb: React.FC<AIOrbProps> = ({ agentState = 'IDLE' }) => {
  const isSpeaking = agentState === 'AGENT_SPEAKING';
  const isListening = agentState === 'LISTENING' || agentState === 'USER_SPEAKING';
  const isProcessing = agentState === 'PROCESSING' || agentState === 'TOOL_CALLING';

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Outer Glow Halo */}
      <motion.div
        className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-purple-600/30 via-violet-500/25 to-cyan-400/20 blur-[60px]"
        animate={{
          scale: isSpeaking ? [1, 1.12, 1] : isListening ? [1, 1.08, 1] : [1, 1.04, 1],
          opacity: isSpeaking ? [0.6, 0.9, 0.6] : isListening ? [0.5, 0.8, 0.5] : [0.35, 0.55, 0.35],
        }}
        transition={{
          duration: isSpeaking ? 1.8 : isListening ? 2.4 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Orbit Track 1 - Clockwise with Sparkles & AudioWaveform */}
      <motion.div
        className="absolute w-[290px] h-[290px] sm:w-[370px] sm:h-[370px] rounded-full border border-purple-500/20 pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      >
        {/* Floating Particle 1 */}
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-purple-900/60 border border-purple-400/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Sparkles size={11} className="text-purple-300 animate-pulse" />
        </div>
        {/* Floating Particle 2 */}
        <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-indigo-900/60 border border-indigo-400/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <AudioWaveform size={11} className="text-cyan-300" />
        </div>
      </motion.div>

      {/* Orbit Track 2 - Counter-Clockwise with BrainCircuit & Mic */}
      <motion.div
        className="absolute w-[330px] h-[330px] sm:w-[420px] sm:h-[420px] rounded-full border border-violet-500/15 pointer-events-none"
        animate={{ rotate: -360 }}
        transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
      >
        {/* Floating Particle 3 */}
        <div className="absolute top-1/2 -left-3 -translate-y-1/2 w-6 h-6 rounded-full bg-violet-900/60 border border-violet-400/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-violet-500/30">
          <BrainCircuit size={11} className="text-violet-300" />
        </div>
        {/* Floating Particle 4 */}
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-purple-900/60 border border-cyan-400/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-cyan-500/30">
          <Mic size={11} className="text-cyan-300" />
        </div>
      </motion.div>

      {/* Core Glass Sphere with Dynamic Breathing */}
      <motion.div
        className="relative w-52 h-52 sm:w-72 sm:h-72 rounded-full flex items-center justify-center cursor-pointer"
        animate={{
          y: [0, -6, 0],
          scale: isSpeaking ? [1, 1.05, 1] : isListening ? [1, 1.03, 1] : [1, 1.02, 1],
        }}
        transition={{
          duration: isSpeaking ? 2 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        whileHover={{ scale: 1.04 }}
      >
        {/* Outer Rim Glass Ring */}
        <div className="absolute inset-0 rounded-full border border-white/20 bg-gradient-to-b from-white/10 to-transparent backdrop-blur-[2px] shadow-[inset_0_2px_12px_rgba(255,255,255,0.2),0_12px_40px_rgba(139,92,246,0.35)]" />

        {/* Inner Gradient Nebula Body */}
        <div className="absolute inset-3 sm:inset-4 rounded-full overflow-hidden bg-gradient-to-tr from-[#0b0518] via-[#1e0f3d] to-[#0f1d3b] shadow-inner">
          {/* Animated Inner Nebula Gradient */}
          <motion.div
            className="absolute -inset-10 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 opacity-60 blur-xl"
            animate={{
              rotate: [0, 180, 360],
              scale: isSpeaking ? [0.9, 1.15, 0.9] : [0.95, 1.05, 0.95],
            }}
            transition={{
              duration: isProcessing ? 6 : 14,
              repeat: Infinity,
              ease: 'linear',
            }}
          />

          {/* Secondary Radial Glow */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.35),transparent_45%)]" />
          
          {/* Glowing Voice Reactive Core / Iris */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-purple-300 via-violet-400 to-cyan-300 blur-[2px] shadow-[0_0_35px_rgba(168,85,247,0.8)] flex items-center justify-center"
              animate={{
                scale: isSpeaking ? [0.85, 1.25, 0.85] : isListening ? [0.9, 1.12, 0.9] : [0.95, 1.05, 0.95],
                opacity: isSpeaking ? [0.8, 1, 0.8] : [0.75, 0.95, 0.75],
              }}
              transition={{
                duration: isSpeaking ? 1.4 : isListening ? 2 : 3.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              {/* Center Black Pupil / Depth Core */}
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-[#05030a] border border-white/40 shadow-inner flex items-center justify-center">
                <div className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full bg-cyan-300 shadow-[0_0_12px_#38bdf8] animate-pulse" />
              </div>
            </motion.div>
          </div>

          {/* Voice Wave Rings Inside Glass */}
          {isSpeaking && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-cyan-400/50"
              animate={{ scale: [0.6, 1.2], opacity: [0.8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
            />
          )}

          {/* Glass Specular Highlights */}
          <div className="absolute top-2 left-6 sm:top-4 sm:left-10 w-16 sm:w-24 h-8 sm:h-12 rounded-full bg-gradient-to-b from-white/40 to-transparent -rotate-45 blur-[1px] pointer-events-none" />
          <div className="absolute bottom-4 right-8 w-8 sm:w-12 h-4 sm:h-6 rounded-full bg-cyan-400/20 rotate-45 blur-[2px] pointer-events-none" />
        </div>
      </motion.div>
    </div>
  );
};
