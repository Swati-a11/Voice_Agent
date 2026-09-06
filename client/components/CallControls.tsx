"use client";

import React from 'react';
import { Phone, PhoneOff, Mic, MicOff, Wifi, WifiOff } from 'lucide-react';
import { ConversationState } from '../types';

interface CallControlsProps {
  state: ConversationState;
  isConnected: boolean;
  isMicActive: boolean;
  isMuted: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  state,
  isConnected,
  isMicActive,
  isMuted,
  onStartCall,
  onEndCall,
  onToggleMute,
}) => {
  const isCallActive = state !== 'IDLE';

  return (
    <div className="flex flex-col items-center gap-3.5 w-full">
      {/* Controls Row */}
      <div className="flex items-center justify-center gap-3 sm:gap-4 w-full">
        {/* Mute Button */}
        <button
          type="button"
          disabled={!isCallActive}
          onClick={onToggleMute}
          title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className={`p-3.5 rounded-full transition-all border ${
            isMuted
              ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
              : 'bg-white/5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10'
          } ${!isCallActive ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Primary Start / End Call Button */}
        {!isCallActive ? (
          <button
            type="button"
            onClick={onStartCall}
            className="px-7 py-3.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-sm sm:text-base tracking-tight flex items-center gap-2.5 shadow-lg shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <Phone size={18} className="animate-pulse text-purple-200" />
            <span>Start Voice Call</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onEndCall}
            className="px-7 py-3.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-medium text-sm sm:text-base tracking-tight flex items-center gap-2.5 shadow-lg shadow-rose-600/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
          >
            <PhoneOff size={18} />
            <span>End Call</span>
          </button>
        )}

        {/* Connection Status Pill */}
        <div className="px-3 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center gap-2 text-xs">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span className="hidden sm:inline">Ready</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <WifiOff size={12} />
              <span className="hidden sm:inline">Offline</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
