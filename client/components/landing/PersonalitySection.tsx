"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Heart, Terminal, BookOpen, Smile, MessageSquareQuote } from 'lucide-react';

export const PersonalitySection: React.FC = () => {
  const [activeChip, setActiveChip] = useState('Hinglish');

  const chips = [
    {
      id: 'English',
      label: 'Natural English',
      icon: MessageSquareQuote,
      description: 'Clear, fluent Indian conversational English with effortless pacing and zero corporate script.',
    },
    {
      id: 'Hinglish',
      label: 'Hinglish',
      icon: Sparkles,
      description: 'Organic code-switching ("haan", "acha", "dekho", "arre yaar") keeping tech terms strictly in English.',
    },
    {
      id: 'Casual',
      label: 'Casual Chat',
      icon: Smile,
      description: 'Friendly two-way dialogue that shares quick observations, jokes, stories, and asks natural questions.',
    },
    {
      id: 'Interview Mode',
      label: 'Interview Prep',
      icon: Terminal,
      description: 'Mock technical interviews asked one question at a time with honest, constructive developer feedback.',
    },
    {
      id: 'Technical',
      label: 'Practical Debugging',
      icon: BookOpen,
      description: '"If I were in your place" perspective that pinpoints backend logs and network errors first.',
    },
    {
      id: 'Emotional Context',
      label: 'Emotional Awareness',
      icon: Heart,
      description: 'Context-aware empathy that calms stress before interviews and celebrates big project wins genuinely.',
    },
  ];

  const currentDetail = chips.find((c) => c.id === activeChip) || chips[1];

  return (
    <section id="personality" className="relative py-20 sm:py-28 px-4 sm:px-6 max-w-5xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-medium mb-4"
        >
          <Heart size={13} />
          <span>Personality & Adaptability</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display font-medium text-3xl sm:text-4xl text-white tracking-tight mb-4"
        >
          Not just another chatbot.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm sm:text-base text-white/55 leading-relaxed"
        >
          A voice companion designed to adapt to your language, conversation style, and mood.
        </motion.p>
      </div>

      {/* Animated Filter Chips */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 mb-10"
      >
        {chips.map((chip) => {
          const isSelected = activeChip === chip.id;
          const Icon = chip.icon;
          return (
            <button
              key={chip.id}
              onClick={() => setActiveChip(chip.id)}
              className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-medium flex items-center gap-2 transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/40 border border-purple-400 scale-[1.03]'
                  : 'bg-white/[0.03] text-white/70 hover:text-white hover:bg-white/[0.07] border border-white/[0.08]'
              }`}
            >
              <Icon size={14} className={isSelected ? 'text-cyan-200' : 'text-purple-300'} />
              <span>{chip.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* Dynamic Detail Card */}
      <motion.div
        key={activeChip}
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="glass-card max-w-xl mx-auto p-6 sm:p-8 text-center border-purple-500/25 shadow-xl shadow-purple-950/40"
      >
        <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-400/30 flex items-center justify-center mx-auto mb-4 text-cyan-300">
          <currentDetail.icon size={18} />
        </div>
        <h4 className="font-display font-semibold text-lg text-white mb-2">
          {currentDetail.label}
        </h4>
        <p className="text-sm text-white/70 leading-relaxed max-w-md mx-auto">
          {currentDetail.description}
        </p>
      </motion.div>
    </section>
  );
};
