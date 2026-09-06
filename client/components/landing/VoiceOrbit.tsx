"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, AudioWaveform, Bot, Circle } from 'lucide-react';

export const VoiceOrbit: React.FC = () => {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
      {/* Central Multi-layered Radial Glows */}
      <div className="absolute w-[320px] h-[320px] sm:w-[460px] sm:h-[460px] rounded-full bg-gradient-to-tr from-[#6f2dff]/30 via-[#8b5cf6]/20 to-[#38bdf8]/15 blur-[90px] pointer-events-none" />
      <div className="absolute w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] rounded-full bg-[#a855f7]/18 blur-[60px] pointer-events-none" />

      {/* 6-8 Glowing Orbit Rings SVG */}
      <svg
        className="w-[380px] h-[380px] sm:w-[530px] sm:h-[530px] md:w-[600px] md:h-[600px] absolute"
        viewBox="0 0 600 600"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ringGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7023ff" stopOpacity="0.45" />
            <stop offset="50%" stopColor="#c084fc" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="ringGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
            <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="ringGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Ring 1: Primary Elliptical Orbit */}
        <motion.ellipse
          cx="300"
          cy="300"
          rx="225"
          ry="165"
          stroke="url(#ringGrad1)"
          strokeWidth="1.2"
          strokeDasharray="16 12"
          className="animate-flow-line-1"
          animate={{
            rotate: [0, 360],
            scale: [0.98, 1.02, 0.98],
          }}
          transition={{
            rotate: { duration: 16, repeat: Infinity, ease: 'linear' },
            scale: { duration: 6, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 2: Counter-rotating Slanted Wave */}
        <motion.ellipse
          cx="300"
          cy="300"
          rx="255"
          ry="135"
          stroke="url(#ringGrad2)"
          strokeWidth="1"
          strokeDasharray="20 16"
          className="animate-flow-line-2"
          animate={{
            rotate: [360, 0],
            scale: [1.02, 0.97, 1.02],
          }}
          transition={{
            rotate: { duration: 20, repeat: Infinity, ease: 'linear' },
            scale: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 3: Deep Curved Waveform Ring */}
        <motion.path
          d="M 120 300 C 140 180, 240 130, 350 140 C 460 150, 490 260, 460 360 C 420 460, 270 480, 180 440 C 130 410, 110 360, 120 300 Z"
          stroke="url(#ringGrad3)"
          strokeWidth="1.1"
          strokeDasharray="14 18"
          className="animate-flow-line-3"
          animate={{
            rotate: [-180, 180],
            scale: [0.97, 1.03, 0.97],
          }}
          transition={{
            rotate: { duration: 26, repeat: Infinity, ease: 'linear' },
            scale: { duration: 8, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 4: Outer Delicate Resonance Arc */}
        <motion.ellipse
          cx="300"
          cy="300"
          rx="280"
          ry="230"
          stroke="rgba(168, 85, 247, 0.15)"
          strokeWidth="0.8"
          strokeDasharray="8 14"
          animate={{
            rotate: [0, 360],
            opacity: [0.15, 0.35, 0.15],
          }}
          transition={{
            rotate: { duration: 32, repeat: Infinity, ease: 'linear' },
            opacity: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 5: Inner Pulse Arc */}
        <motion.ellipse
          cx="300"
          cy="300"
          rx="170"
          ry="120"
          stroke="rgba(56, 189, 248, 0.22)"
          strokeWidth="1"
          strokeDasharray="6 10"
          animate={{
            scale: [0.95, 1.05, 0.95],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: 'center' }}
        />

        {/* Ring 6: Inclined Sound Wave Arc */}
        <motion.ellipse
          cx="300"
          cy="300"
          rx="205"
          ry="190"
          stroke="rgba(192, 132, 252, 0.18)"
          strokeWidth="0.9"
          strokeDasharray="12 18"
          animate={{
            rotate: [180, -180],
            scale: [1, 1.03, 1],
          }}
          transition={{
            rotate: { duration: 24, repeat: Infinity, ease: 'linear' },
            scale: { duration: 6.5, repeat: Infinity, ease: 'easeInOut' },
          }}
          style={{ transformOrigin: 'center' }}
        />
      </svg>

      {/* Floating Ambient Particles (5-8 subtle particles) */}
      <motion.div
        className="absolute top-[22%] left-[18%] flex items-center justify-center pointer-events-none"
        animate={{
          y: [-5, 7, -5],
          x: [2, -4, 2],
          opacity: [0.4, 0.9, 0.4],
        }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Sparkles size={12} className="text-purple-300 drop-shadow-[0_0_8px_#c084fc]" />
      </motion.div>

      <motion.div
        className="absolute bottom-[24%] right-[18%] flex items-center justify-center pointer-events-none"
        animate={{
          y: [6, -6, 6],
          x: [-3, 4, -3],
          opacity: [0.3, 0.85, 0.3],
        }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      >
        <AudioWaveform size={13} className="text-cyan-300 drop-shadow-[0_0_8px_#38bdf8]" />
      </motion.div>

      <motion.div
        className="absolute top-[32%] right-[22%] w-2 h-2 rounded-full bg-cyan-300 blur-[0.5px] shadow-[0_0_10px_#38bdf8]"
        animate={{
          y: [-4, 5, -4],
          opacity: [0.3, 0.8, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
      />

      <motion.div
        className="absolute bottom-[30%] left-[22%] w-1.5 h-1.5 rounded-full bg-violet-400 blur-[0.5px] shadow-[0_0_8px_#a855f7]"
        animate={{
          y: [5, -5, 5],
          opacity: [0.4, 0.9, 0.4],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      <motion.div
        className="absolute top-[18%] right-[32%] flex items-center justify-center pointer-events-none"
        animate={{
          y: [-3, 4, -3],
          opacity: [0.2, 0.6, 0.2],
        }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
      >
        <Sparkles size={10} className="text-cyan-200 drop-shadow-[0_0_6px_#38bdf8]" />
      </motion.div>

      <motion.div
        className="absolute bottom-[16%] left-[34%] w-1.5 h-1.5 rounded-full bg-pink-400/80 blur-[0.4px] shadow-[0_0_6px_#ec4899]"
        animate={{
          y: [3, -4, 3],
          opacity: [0.25, 0.7, 0.25],
        }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
    </div>
  );
};
