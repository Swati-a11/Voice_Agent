"use client";

import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, User, Bot, Trash2, Send, Sparkles } from 'lucide-react';
import { ConversationTurn } from '../types';

interface ConversationTranscriptProps {
  turns: ConversationTurn[];
  isOpen: boolean;
  onToggle?: () => void;
  onClear: () => void;
  onSendMessage?: (text: string) => void;
}

export const ConversationTranscript: React.FC<ConversationTranscriptProps> = ({
  turns,
  isOpen,
  onClear,
  onSendMessage,
}) => {
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    if (isOpen) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !onSendMessage) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="w-full bg-[#0d091e]/80 backdrop-blur-xl rounded-2xl border border-white/[0.08] overflow-hidden shadow-xl">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <MessageSquare size={16} className="text-purple-400" />
          <span className="font-semibold text-sm text-white">Live Conversation Transcript</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 font-mono">
            {turns.length} messages
          </span>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            title="Clear transcript"
            className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Transcript Messages List */}
      <div className="p-4 max-h-72 overflow-y-auto space-y-3 text-sm">
        {turns.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs italic flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-white/[0.03] text-purple-400">
              <Sparkles size={18} />
            </div>
            <span>No messages yet. Tap &ldquo;Start Voice Call&rdquo; or type below to chat.</span>
          </div>
        ) : (
          turns.map((turn) => {
            const isUser = turn.role === 'user';
            return (
              <div
                key={turn.id}
                className={`flex flex-col gap-1.5 p-3 rounded-xl transition-all ${
                  isUser
                    ? 'bg-cyan-950/30 border border-cyan-500/20 ml-6 sm:ml-12'
                    : 'bg-purple-950/30 border border-purple-500/20 mr-6 sm:mr-12'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 font-medium">
                    {isUser ? (
                      <>
                        <User size={13} className="text-cyan-400" />
                        <span className="text-cyan-300">You</span>
                      </>
                    ) : (
                      <>
                        <Bot size={13} className="text-purple-400" />
                        <span className="text-purple-300">Ayra</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>

                <p className="text-slate-100 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                  {turn.text}
                </p>
              </div>
            );
          })
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Input Box for typing when user cannot speak */}
      {onSendMessage && (
        <form onSubmit={handleSubmit} className="p-3 border-t border-white/[0.06] bg-white/[0.01] flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message or question (e.g. 'Can you tell me a story?')..."
            className="flex-1 px-4 py-2.5 rounded-full bg-white/[0.05] border border-white/[0.1] text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-full bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:hover:bg-purple-600 text-white transition-all cursor-pointer"
          >
            <Send size={15} />
          </button>
        </form>
      )}
    </div>
  );
};
