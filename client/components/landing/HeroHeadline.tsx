"use client";

import React from 'react';
import { motion } from 'framer-motion';

export const HeroHeadline: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center px-4">
      {/* 2-Line Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        className="font-display font-medium text-white tracking-tight leading-[1.12] mb-3 text-[36px] sm:text-[48px] md:text-[56px] lg:text-[62px]"
        style={{ letterSpacing: '-0.025em' }}
      >
        How may I help you <br className="block" />
        today!
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
        className="text-xs sm:text-sm md:text-base text-white/55 font-normal max-w-[480px] leading-relaxed"
      >
        Your personal AI companion, ready to talk whenever you are.
      </motion.p>
    </div>
  );
};
