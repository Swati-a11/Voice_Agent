"use client";

import React from 'react';
import { useVoiceContext } from '../../context/VoiceAgentContext';
import { PersonalAIBadge } from './PersonalAIBadge';
import { AICharacter } from './AICharacter';
import { HeroHeadline } from './HeroHeadline';
import { GetStartedButton } from './GetStartedButton';
import { VoiceStatus } from './VoiceStatus';
import { CursorGlow } from './CursorGlow';

export const LandingPage: React.FC = () => {
  const { state } = useVoiceContext();

  return (
    <div className="relative min-h-[100svh] w-full bg-[#05030A] text-[#f8f7fb] overflow-hidden flex flex-col items-center justify-between px-4 pt-[max(1.75rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] select-none">
      {/* Desktop Cursor Ambient Glow */}
      <CursorGlow />

      {/* 1. Top Section: Personal AI Buddy Pill */}
      <div className="w-full flex justify-center pt-2 sm:pt-4 z-20">
        <PersonalAIBadge />
      </div>

      {/* 2. Middle Section: AI Robot Character with Flowing Waves */}
      <div className="w-full flex-1 flex flex-col items-center justify-center my-auto py-2 sm:py-4 z-10 relative">
        <AICharacter agentState={state} />
        <div className="mt-2">
          <VoiceStatus agentState={state} />
        </div>
      </div>

      {/* 3. Bottom Section: 2-Line Headline & White CTA Button */}
      <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-5 sm:gap-6 z-20 pb-2 sm:pb-6">
        <HeroHeadline />
        <GetStartedButton />
      </div>
    </div>
  );
};
