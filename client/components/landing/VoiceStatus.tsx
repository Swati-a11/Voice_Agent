"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ConversationState } from '../../types';

interface VoiceStatusProps {
  agentState?: ConversationState;
}

export const VoiceStatus: React.FC<VoiceStatusProps> = ({ agentState = 'IDLE' }) => {
  const getStatusText = () => {
    switch (agentState) {
      case 'LISTENING':
      case 'USER_SPEAKING':
        return 'Listening...';
      case 'PROCESSING':
      case 'TOOL_CALLING':
        return 'Thinking...';
      case 'AGENT_SPEAKING':
        return 'Speaking...';
      case 'INTERRUPTED':
        return 'Listening to you...';
      case 'IDLE':
      default:
        return 'Ready to talk';
    }
  };

  return (
    <div className="h-5 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={agentState}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="text-xs font-mono text-purple-300/70 flex items-center gap-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>{getStatusText()}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
