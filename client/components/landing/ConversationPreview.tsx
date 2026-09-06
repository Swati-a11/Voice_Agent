"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Mic, AudioWaveform, User, Bot, Play } from 'lucide-react';
import Link from 'next/link';

export const ConversationPreview: React.FC = () => {
  const turns = [
    {
      speaker: 'user',
      label: 'You',
      text: "I have an interview in three hours and I'm really stressed.",
      time: 'Just now',
    },
    {
      speaker: 'agent',
      label: 'Ayra',
      text: "Arre yaar, three hours is pretty close. I get why you're stressed. If I were in your place, I wouldn't start learning new topics now. Let's do a quick mock interview together. Ready?",
      time: 'Streaming audio',
      isAudioPlaying: true,
    },
    {
      speaker: 'user',
      label: 'You',
      text: 'Take my React interview.',
      time: 'A moment ago',
    },
    {
      speaker: 'agent',
      label: 'Ayra',
      text: "Okay, let's do it! First question: what is React, and why would you choose it for building modern web applications?",
      time: 'Streaming audio',
    },
  ];

  return (
    <section id="preview" className="relative py-20 sm:py-28 px-4 sm:px-6 max-w-4xl mx-auto">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-4"
        >
          <Sparkles size={13} />
          <span>Live Conversation Preview</span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display font-medium text-3xl sm:text-4xl text-white tracking-tight mb-4"
        >
          See how natural it feels
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-sm sm:text-base text-white/55 leading-relaxed"
        >
          An organic, thoughtful conversational partner ready for coaching, casual discussions, and troubleshooting.
        </motion.p>
      </div>

      {/* Mock Chat Panel Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="glass-panel overflow-hidden border-purple-500/20 shadow-2xl shadow-purple-950/40"
      >
        {/* Chat Window Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-400 flex items-center justify-center text-white">
              <Sparkles size={15} />
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                Ayra
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="text-[11px] text-white/40">Swati-Inspired • Natural Hinglish</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-purple-300 font-mono bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full">
              Mock Interview Mode
            </span>
          </div>
        </div>

        {/* Turns List */}
        <div className="p-6 sm:p-8 flex flex-col gap-4">
          {turns.map((turn, idx) => {
            const isAgent = turn.speaker === 'agent';
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.12 }}
                className={`flex gap-3 max-w-xl ${isAgent ? 'self-start' : 'self-end flex-row-reverse'}`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs ${
                    isAgent
                      ? 'bg-purple-600/40 border border-purple-400/40 text-purple-200'
                      : 'bg-white/10 border border-white/20 text-white/70'
                  }`}
                >
                  {isAgent ? <Bot size={14} /> : <User size={14} />}
                </div>

                <div
                  className={`rounded-2xl p-4 text-sm leading-relaxed ${
                    isAgent
                      ? 'bg-purple-950/30 border border-purple-500/30 text-purple-100 shadow-md shadow-purple-950/30'
                      : 'bg-white/[0.06] border border-white/[0.1] text-white/90'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1 text-[11px] font-medium opacity-60">
                    <span>{turn.label}</span>
                    <span className="text-[10px] font-mono">{turn.time}</span>
                  </div>

                  <p>{turn.text}</p>

                  {turn.isAudioPlaying && (
                    <div className="mt-3 pt-2.5 border-t border-purple-500/20 flex items-center gap-2 text-cyan-300 text-xs font-mono">
                      <AudioWaveform size={14} className="animate-pulse" />
                      <span>Natural Indian English TTS (1.05x)</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Chat Action Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.015] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <span className="text-xs text-white/50">
            Ready to try a live voice conversation?
          </span>

          <Link
            href="/agent"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-white/90 flex items-center gap-2 shadow-lg shadow-purple-950/50 hover:scale-105 transition-all"
          >
            <Mic size={14} className="text-purple-600" />
            <span>Try Live on Microphone</span>
          </Link>
        </div>
      </motion.div>
    </section>
  );
};
