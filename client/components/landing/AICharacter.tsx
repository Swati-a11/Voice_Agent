"use client";

import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Bot, AudioWaveform } from 'lucide-react';
import { ConversationState } from '../../types';
import { VoiceOrbit } from './VoiceOrbit';

interface AICharacterProps {
  agentState?: ConversationState;
}

export const AICharacter: React.FC<AICharacterProps> = ({ agentState = 'IDLE' }) => {
  const isSpeaking = agentState === 'AGENT_SPEAKING';
  const isListening = agentState === 'LISTENING' || agentState === 'USER_SPEAKING';
  const isProcessing = agentState === 'PROCESSING' || agentState === 'TOOL_CALLING';

  // Desktop Mouse Tilt Physics (disabled on mobile)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768) {
        setIsTouchDevice(true);
      }
    }
  }, []);

  const smoothX = useSpring(mouseX, { stiffness: 100, damping: 20 });
  const smoothY = useSpring(mouseY, { stiffness: 100, damping: 20 });

  // Mouse tilt bounded strictly within ±5 degrees
  const rotateY = useTransform(smoothX, [-250, 250], [-5, 5]);
  const rotateX = useTransform(smoothY, [-250, 250], [5, -5]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isTouchDevice) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex flex-col items-center justify-center select-none w-full max-w-[340px] sm:max-w-[420px] md:max-w-[500px] aspect-square"
      style={{ perspective: 1000 }}
    >
      {/* 1. Background Flowing Orbit Waves & Particles */}
      <VoiceOrbit />

      {/* 2. Layered 3D Glows Behind Robot: Large Purple, Medium Violet, Small Cyan */}
      <motion.div
        className="absolute w-72 h-72 sm:w-96 sm:h-96 md:w-[440px] md:h-[440px] rounded-full bg-[#6f2dff]/28 blur-[85px] pointer-events-none"
        animate={{
          scale: isSpeaking ? [1, 1.18, 1] : isListening ? [1, 1.1, 1] : [1, 1.04, 1],
          opacity: isSpeaking ? [0.65, 0.95, 0.65] : isListening ? [0.55, 0.85, 0.55] : [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: isSpeaking ? 1.6 : isListening ? 2.2 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 rounded-full bg-[#a855f7]/30 blur-[50px] pointer-events-none"
        animate={{
          scale: isSpeaking ? [1, 1.15, 1] : isListening ? [1, 1.08, 1] : [1, 1.03, 1],
          opacity: isSpeaking ? [0.7, 1, 0.7] : isListening ? [0.6, 0.9, 0.6] : [0.5, 0.7, 0.5],
        }}
        transition={{
          duration: isSpeaking ? 1.8 : isListening ? 2.5 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.2,
        }}
      />
      <motion.div
        className="absolute w-28 h-28 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-full bg-[#38bdf8]/25 blur-[25px] pointer-events-none"
        animate={{
          scale: isSpeaking ? [1, 1.25, 1] : [1, 1.05, 1],
          opacity: isSpeaking ? [0.8, 1, 0.8] : [0.45, 0.65, 0.45],
        }}
        transition={{
          duration: isSpeaking ? 1.4 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Speaking Voice Audio Wave Ring Expansion */}
      {isSpeaking && (
        <motion.div
          className="absolute w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 rounded-full border-2 border-cyan-400/50 pointer-events-none"
          animate={{ scale: [0.75, 1.4], opacity: [0.9, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
        />
      )}

      {/* 3. Main 3D Floating Robot Body with Tilt & Floating Animation */}
      <motion.div
        style={{
          rotateX: isTouchDevice ? 0 : rotateX,
          rotateY: isTouchDevice ? 0 : rotateY,
          transformStyle: 'preserve-3d',
        }}
        animate={{
          y: isSpeaking ? [0, -9, 0] : isListening ? [0, -6, 0] : [0, -8, 0],
          rotateZ: [0, 0.5, 0],
        }}
        transition={{
          duration: isSpeaking ? 2 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative z-10 flex items-center justify-center cursor-pointer"
        aria-label="3D AI voice companion robot"
      >
        {/* SVG Definition for Metallic 3D Robot Gradient */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="robot3dGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#c4f1ff" />
              <stop offset="50%" stopColor="#d8c7ff" />
              <stop offset="70%" stopColor="#f3c8ed" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
            <linearGradient id="robotHighlightGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#c4f1ff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>

        {/* 3D LAYER 1: Deep Outer Depth Shadow (x: 6px, y: 9px) */}
        <div
          className="absolute text-[#0b051b] pointer-events-none filter blur-[3.5px] opacity-80"
          style={{ transform: 'translate(6px, 9px)' }}
        >
          <Bot
            className="w-[210px] h-[210px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px]"
            strokeWidth={2.4}
          />
        </div>

        {/* 3D LAYER 2: Medium Purple Extrusion Depth (x: 4px, y: 6px) */}
        <div
          className="absolute text-[#3b126d] pointer-events-none filter blur-[1px] opacity-85"
          style={{ transform: 'translate(4px, 6px)' }}
        >
          <Bot
            className="w-[210px] h-[210px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px]"
            strokeWidth={2.3}
          />
        </div>

        {/* 3D LAYER 3: Near-Edge Violet Extrusion (x: 2px, y: 3px) */}
        <div
          className="absolute text-[#6d28d9] pointer-events-none opacity-90 filter drop-shadow-[0_0_12px_rgba(109,40,217,0.75)]"
          style={{ transform: 'translate(2px, 3px)' }}
        >
          <Bot
            className="w-[210px] h-[210px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px]"
            strokeWidth={2.2}
          />
        </div>

        {/* 3D LAYER 4: Main Front Metallic Bot with Gradient Surface */}
        <div className="relative filter drop-shadow-[0_0_35px_rgba(168,85,247,0.85)]">
          <Bot
            className="w-[210px] h-[210px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px]"
            strokeWidth={2}
            stroke="url(#robot3dGradient)"
            fill="rgba(255, 255, 255, 0.04)"
          />

          {/* 3D Holographic Eye Visor Lights */}
          <div className="absolute top-[41%] left-[32%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full bg-cyan-300 shadow-[0_0_14px_#38bdf8] flex items-center justify-center">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse" />
          </div>
          <div className="absolute top-[41%] right-[32%] translate-x-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 rounded-full bg-cyan-300 shadow-[0_0_14px_#38bdf8] flex items-center justify-center">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white animate-pulse" />
          </div>

          {/* 3D Glowing Chest Power Core / Audio Waveform Pulse */}
          <div className="absolute bottom-[28%] left-1/2 -translate-x-1/2 w-9 h-4 sm:w-11 sm:h-5 md:w-13 md:h-6 rounded-full bg-purple-950/70 border border-purple-400/60 flex items-center justify-center shadow-[0_0_14px_rgba(168,85,247,0.85)] overflow-hidden">
            <AudioWaveform
              size={15}
              className={`text-cyan-300 ${isSpeaking ? 'animate-pulse scale-115' : ''}`}
            />
          </div>

          {/* Antenna Glowing Beacon Light */}
          <div className="absolute top-[3%] left-1/2 -translate-x-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-cyan-300 shadow-[0_0_16px_#38bdf8] flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </div>
        </div>

        {/* 3D LAYER 5: Specular Highlight / Glass Sheen Overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-65 mix-blend-overlay"
          style={{ transform: 'translate(-1px, -1.5px)' }}
        >
          <Bot
            className="w-[210px] h-[210px] sm:w-[260px] sm:h-[260px] md:w-[320px] md:h-[320px]"
            strokeWidth={1.2}
            stroke="url(#robotHighlightGrad)"
          />
        </div>
      </motion.div>

      {/* 4. Floor Shadow underneath Floating Robot */}
      <motion.div
        className="w-40 h-4 sm:w-56 sm:h-6 md:w-68 md:h-7 rounded-[100%] bg-gradient-to-r from-purple-950/0 via-purple-600/35 to-purple-950/0 blur-md mt-2 pointer-events-none"
        animate={{
          scale: isSpeaking ? [1, 0.82, 1] : [1, 0.88, 1],
          opacity: isSpeaking ? [0.65, 0.35, 0.65] : [0.55, 0.3, 0.55],
        }}
        transition={{
          duration: isSpeaking ? 2 : 4.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
};
