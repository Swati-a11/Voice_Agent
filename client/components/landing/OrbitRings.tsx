"use client";

import React from 'react';
import { motion } from 'framer-motion';

export const OrbitRings: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {/* Ring 1 - Innermost */}
      <motion.div
        className="absolute rounded-full border border-purple-500/20"
        style={{ width: '380px', height: '380px' }}
        animate={{
          scale: [0.96, 1.04, 0.96],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Ring 2 */}
      <motion.div
        className="absolute rounded-full border border-purple-400/15"
        style={{ width: '520px', height: '520px' }}
        animate={{
          scale: [1.03, 0.97, 1.03],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 9,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Ring 3 */}
      <motion.div
        className="absolute rounded-full border border-indigo-500/12"
        style={{ width: '680px', height: '680px' }}
        animate={{
          scale: [0.97, 1.03, 0.97],
          opacity: [0.12, 0.25, 0.12],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Ring 4 */}
      <motion.div
        className="absolute rounded-full border border-purple-600/10"
        style={{ width: '860px', height: '860px' }}
        animate={{
          scale: [1.02, 0.98, 1.02],
          opacity: [0.08, 0.18, 0.08],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Ring 5 - Outermost */}
      <motion.div
        className="absolute rounded-full border border-violet-500/8"
        style={{ width: '1060px', height: '1060px' }}
        animate={{
          scale: [0.98, 1.02, 0.98],
          opacity: [0.05, 0.14, 0.05],
        }}
        transition={{
          duration: 14,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Central Ambient Glow */}
      <div 
        className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-tr from-purple-600/25 via-violet-600/20 to-cyan-500/15 blur-[90px] pointer-events-none"
      />
    </div>
  );
};
