"use client";

import React from 'react';
import { Layers, CornerDownRight } from 'lucide-react';
import { TopicItem } from '../types';

interface TopicStackViewerProps {
  currentTopic: TopicItem | null;
  topicStack: TopicItem[];
}

export const TopicStackViewer: React.FC<TopicStackViewerProps> = ({ currentTopic, topicStack }) => {
  return (
    <div className="bg-[#0d091e]/80 backdrop-blur-xl p-5 rounded-2xl border border-white/[0.08] shadow-xl space-y-4">
      <div className="flex items-center justify-between text-xs font-semibold text-white">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-cyan-400" />
          <span>Topic Tracking &amp; Context</span>
        </div>
        <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
          Depth: {topicStack.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {/* Active Current Topic */}
        <div className="p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/25 text-xs space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Active Topic</span>
          </div>
          <div className="font-semibold text-white text-sm">{currentTopic?.name || 'General Catchup'}</div>
          <div className="text-slate-400 text-xs">{currentTopic?.summary || 'Natural casual opening conversation'}</div>
        </div>

        {/* Suspended Topics in Stack */}
        {topicStack.length > 0 && (
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
              Paused Context (Resumes when returning to earlier thoughts)
            </div>
            {topicStack.map((topic, index) => (
              <div
                key={topic.id || index}
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2 text-slate-300">
                  <CornerDownRight size={13} className="text-slate-500" />
                  <span className="font-medium">{topic.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">Layer #{topicStack.length - index}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
