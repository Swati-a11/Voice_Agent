"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, BrainCircuit, AudioLines, ArrowRight } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      number: '01',
      icon: Mic,
      title: 'Speak Naturally',
      description: 'Talk just like you would to a friend or colleague. Use natural Indian English, occasional Hinglish, or technical code terms.',
    },
    {
      number: '02',
      icon: BrainCircuit,
      title: 'Real-Time Understanding',
      description: 'Your intent, emotional tone, pronouns, and conversation topic stack are parsed in real time without laggy round-trips.',
    },
    {
      number: '03',
      icon: AudioLines,
      title: 'Fluid Human Response',
      description: 'Spoken audio streams instantly with natural pauses, expressive intonation, and zero-cost local browser audio synthesis.',
    },
  ];

  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 px-4 sm:px-6 max-w-6xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-medium mb-4"
        >
          <AudioLines size={13} />
          <span>Workflow</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display font-medium text-3xl sm:text-4xl text-white tracking-tight mb-4"
        >
          How conversational voice happens
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm sm:text-base text-white/55 leading-relaxed"
        >
          A continuous high-speed loop designed for instant turn-taking and natural human barge-in.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className="glass-card group relative p-7 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-900/40 to-indigo-900/30 border border-purple-500/30 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon size={22} className="text-purple-300 group-hover:text-cyan-300 transition-colors" />
                  </div>
                  <span className="font-mono text-2xl font-bold text-white/15 group-hover:text-purple-400/40 transition-colors">
                    {step.number}
                  </span>
                </div>

                <h3 className="font-display font-semibold text-lg text-white mb-2.5">
                  {step.title}
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  {step.description}
                </p>
              </div>

              {/* Progress Connector line on desktop */}
              {idx < steps.length - 1 && (
                <div className="hidden md:flex absolute top-1/2 -right-3.5 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-[#08050f] border border-white/10 items-center justify-center text-white/30">
                  <ArrowRight size={12} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
