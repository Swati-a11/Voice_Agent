"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ConversationState } from '../types';
import { AudioLines, Sparkles } from 'lucide-react';

const statusText: Record<ConversationState, string> = {
  IDLE: 'Whenever you’re ready', LISTENING: 'I’m listening', USER_SPEAKING: 'I’m listening',
  PROCESSING: 'One moment…', TOOL_CALLING: 'Let me check that',
  AGENT_SPEAKING: 'Ira’s talking', INTERRUPTED: 'Go ahead', BACKCHANNEL: 'I’m with you',
  TOPIC_SWITCH: 'Let’s talk about that', TOPIC_RETURN: 'Picking up where we left off', WAITING_FOR_CONTINUATION: 'Take your time',
};

export function DuoVisualizer({ state, audioLevel = 0, isPlaying = false }: { state: ConversationState; audioLevel?: number; isPlaying?: boolean }) {
  const active = state !== 'IDLE';
  const talking = state === 'AGENT_SPEAKING' || isPlaying;
  return (
    <div className={`duo-stage ${active ? 'duo-stage-active' : ''}`}>
      <div className="duo-stage-wash" />
      <motion.div className="duo-ring duo-ring-back" animate={{ rotate: 360 }} transition={{ duration: 65, repeat: Infinity, ease: 'linear' }}><i /><i /></motion.div>
      <motion.div className="duo-ring duo-ring-front" animate={{ rotate: -360 }} transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}><i /></motion.div>
      <div className="duo-stage-sparkle sparkle-a"><Sparkles size={20} /></div>
      <Sparkles className="duo-stage-sparkle sparkle-b" size={19} />
      <motion.div
        className={`duo-friends ${talking ? 'duo-friends-speaking' : ''}`}
        animate={{ y: active ? [0, -8, 0] : [0, -5, 0], scale: talking ? [1, 1.025, 1] : [1, 1.01, 1] }}
        transition={{ duration: talking ? 1.2 : 4.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ ['--voice-level' as string]: audioLevel }}
      >
        <Image src="/ira-nobita-doraemon.png" alt="Doraemon and Nobita, smiling together" width={1024} height={1024} priority className="duo-friends-image" />
      </motion.div>
      <div className="duo-shadow" />
      <div className="duo-status"><span className={`duo-status-dot ${active ? 'is-active' : ''}`} /><AudioLines size={14} /><span>{statusText[state]}</span></div>
    </div>
  );
}
