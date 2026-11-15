"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ConversationState } from '../types';
import { AudioLines, Sparkles } from 'lucide-react';

const statusText: Record<ConversationState, string> = {
  IDLE: 'Ready when you are', LISTENING: 'Listening to you', USER_SPEAKING: 'Listening to you',
  PROCESSING: 'Thinking it through', TOOL_CALLING: 'Finding the right answer',
  AGENT_SPEAKING: 'Ira is talking', INTERRUPTED: 'Listening to you', BACKCHANNEL: 'Following along',
  TOPIC_SWITCH: 'Following the new topic', TOPIC_RETURN: 'Picking up where we left off', WAITING_FOR_CONTINUATION: 'I’m here with you',
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
