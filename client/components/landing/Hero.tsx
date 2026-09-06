"use client";

import React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, PlayCircle, ChevronDown, Mic } from 'lucide-react';
import { OrbitRings } from './OrbitRings';
import { AIOrb } from './AIOrb';
import { VoiceStatusPill } from './VoiceStatusPill';
import { ConversationState } from '../../types';

interface HeroProps {
  agentState?: ConversationState;
}

export const Hero: React.FC<HeroProps> = ({ agentState = 'IDLE' }) => {
  const getHumanStateText = () => {
    switch (agentState) {
      case 'LISTENING':
      case 'USER_SPEAKING':
        return 'Listening closely...';
      case 'PROCESSING':
      case 'TOOL_CALLING':
        return 'Thinking...';
      case 'AGENT_SPEAKING':
        return 'Speaking...';
      case 'INTERRUPTED':
        return 'Listening to you...';
      case 'IDLE':
      default:
        return 'Ready when you are';
    }
  };

  return (
    <section className="relative min-h-[100svh] w-full flex flex-col items-center justify-center px-4 sm:px-6 pt-24 pb-12 overflow-hidden">
      {/* Background Animated Concentric Rings */}
      <OrbitRings />

      {/* Main Content Container with Staggered Entrance */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* 1. Personal AI Pill */}
        <div className="mb-6 sm:mb-8">
          <VoiceStatusPill statusText="Personal AI Companion" />
        </div>

        {/* 2. Central AI Visual / Orb */}
        <div className="mb-6 sm:mb-8">
          <AIOrb agentState={agentState} />
        </div>

        {/* 3. Human-like State Status Tag */}
        <div className="h-6 mb-4 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={agentState}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="text-xs sm:text-sm font-medium text-purple-300/80 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span>{getHumanStateText()}</span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 4. Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-display font-medium text-white tracking-tight leading-[1.1] mb-4 text-[38px] sm:text-[54px] md:text-[64px]"
          style={{ letterSpacing: '-0.03em' }}
        >
          How may I help you today?
        </motion.h1>

        {/* 5. Personalized Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-sm sm:text-base md:text-lg text-white/60 max-w-[580px] font-normal leading-relaxed mb-8 sm:mb-10 px-4"
        >
          Your personal AI companion that listens, understands, and talks with you naturally.
        </motion.p>

        {/* 6. Primary and Secondary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto px-6 mb-10"
        >
          <Link
            href="/agent"
            className="btn-hero-cta w-full sm:w-auto min-w-[210px] h-[54px]"
          >
            <Mic size={18} className="text-purple-600" />
            <span>Start Conversation</span>
            <ArrowRight size={17} className="text-black/70" />
          </Link>

          <a
            href="#how-it-works"
            className="btn-secondary-ghost w-full sm:w-auto h-[54px]"
          >
            <PlayCircle size={17} className="text-purple-300" />
            <span>See how it works</span>
          </a>
        </motion.div>

        {/* 7. Voice Status Mini Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 rounded-2xl bg-white/[0.025] border border-white/[0.07] backdrop-blur-md text-[11px] sm:text-xs text-white/60 shadow-lg shadow-black/20"
        >
          <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#38bdf8]" />
            <span>Voice ready</span>
          </div>
          <span className="hidden sm:inline text-white/20">•</span>
          <span>Natural conversation</span>
          <span className="hidden sm:inline text-white/20">•</span>
          <span>Real-time interruption</span>
          <span className="hidden sm:inline text-white/20">•</span>
          <span className="text-purple-300 font-medium">English + Hinglish</span>
        </motion.div>
      </div>

      {/* 8. Animated Scroll Indicator */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/35 hover:text-white/70 transition-colors pointer-events-auto cursor-pointer"
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        onClick={() => {
          const el = document.getElementById('features');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      >
        <span className="text-[10px] tracking-widest uppercase font-mono">Explore</span>
        <ChevronDown size={15} />
      </motion.div>
    </section>
  );
};
