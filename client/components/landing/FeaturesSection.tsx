"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, AudioWaveform, Mic, BrainCircuit, Sparkles } from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  const features = [
    {
      icon: MessageCircle,
      title: 'Natural Conversations',
      description: 'Talk naturally without rigid commands, keyword triggers, or scripted robotic responses.',
      tag: 'Fluent & Adaptive',
      color: 'from-purple-500 to-indigo-500',
    },
    {
      icon: AudioWaveform,
      title: 'Real-Time Voice',
      description: 'Ultra-low latency streaming voice interaction built for lively, uninterrupted turn-taking.',
      tag: 'Sub-400ms TTFA',
      color: 'from-cyan-400 to-blue-500',
    },
    {
      icon: Mic,
      title: 'Interrupt Anytime',
      description: 'Speak freely while the AI is talking. It detects your voice and yields instantly without awkward delays.',
      tag: 'Instant Barge-In',
      color: 'from-pink-500 to-purple-500',
    },
    {
      icon: BrainCircuit,
      title: 'Understands Context',
      description: 'Switch topics, return to earlier ideas, resolve pronouns naturally, and recall past conversational facts.',
      tag: 'Topic Stack & Memory',
      color: 'from-violet-400 to-purple-600',
    },
  ];

  return (
    <section id="features" className="relative py-20 sm:py-28 px-4 sm:px-6 max-w-6xl mx-auto">
      {/* Subtle Section Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-purple-900/10 blur-[120px] pointer-events-none" />

      <div className="relative z-10 text-center max-w-2xl mx-auto mb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium mb-4"
        >
          <Sparkles size={13} />
          <span>Core Capabilities</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display font-medium text-3xl sm:text-4xl text-white tracking-tight mb-4"
        >
          Engineered to feel like a real person
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm sm:text-base text-white/55 leading-relaxed"
        >
          Combining real-time speech intelligence, low-latency streaming, and human conversational habits into one seamless experience.
        </motion.p>
      </div>

      {/* Feature Grid */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {features.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="glass-card group relative p-6 sm:p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-purple-500/40 group-hover:bg-purple-950/40 transition-all duration-300">
                    <Icon size={22} className="text-purple-300 group-hover:text-cyan-300 transition-colors" />
                  </div>
                  <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/50 group-hover:text-purple-200 transition-colors">
                    {feature.tag}
                  </span>
                </div>

                <h3 className="font-display font-semibold text-xl text-white mb-2.5 group-hover:text-purple-100 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {feature.description}
                </p>
              </div>

              {/* Decorative Corner Glow */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/0 group-hover:bg-purple-500/10 rounded-full blur-xl transition-all duration-500 pointer-events-none" />
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
