"use client";

import React from 'react';
import { motion } from 'framer-motion';

export const PersonalAIBadge: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(139,92,246,0.18)] border border-[rgba(139,92,246,0.35)] backdrop-blur-md shadow-[0_0_20px_rgba(139,92,246,0.25)] select-none"
    >
      {/* Animated Glowing Status Dot */}
      <span className="relative flex h-2 w-2">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-purple-400"
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.8, 0, 0.8],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400 shadow-[0_0_8px_#a855f7]" />
      </span>

      <span className="text-xs sm:text-sm font-medium text-purple-200 tracking-wide">
        Personal AI Buddy
      </span>
    </motion.div>
  );
};
