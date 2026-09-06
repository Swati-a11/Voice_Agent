"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface VoiceStatusPillProps {
  statusText?: string;
}

export const VoiceStatusPill: React.FC<VoiceStatusPillProps> = ({ statusText = 'Personal AI Companion' }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-purple-950/40 border border-purple-500/30 backdrop-blur-md shadow-sm shadow-purple-900/30 select-none"
    >
      {/* Animated Glowing Dot */}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
      </span>

      <span className="text-xs font-medium text-purple-200/90 tracking-wide">
        {statusText}
      </span>
      <span className="text-[10px] text-cyan-300 font-medium px-1.5 py-0.2 rounded-full bg-cyan-500/10 border border-cyan-400/20">
        Online
      </span>
    </motion.div>
  );
};
