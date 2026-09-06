"use client";

import React, { useState } from 'react';
import { Sparkles, Coffee, Compass, Flame, ChevronDown } from 'lucide-react';
import { PersonaConfig } from '../types';

interface PersonaSwitcherProps {
  activePersona: PersonaConfig;
  onSelectPersona: (personaName: string) => void;
  disabled?: boolean;
}

export const PERSONA_OPTIONS = [
  {
    name: 'Ayra',
    title: 'Ayra (Default)',
    subtitle: "Swati-Inspired • Natural Hinglish",
    description: "Friendly, expressive, thoughtful companion with organic Hinglish expressions (haan, acha, arre, yaar, dekho).",
    icon: Sparkles,
    color: 'text-purple-300 bg-purple-500/15 border-purple-500/30',
  },
  {
    name: 'Zephyr',
    title: 'Zephyr',
    subtitle: 'Chill Roommate • Relaxed & Grounded',
    description: "Laid-back, calm, empathetic conversationalist for casual late-night discussions.",
    icon: Coffee,
    color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
  },
  {
    name: 'Aria',
    title: 'Aria',
    subtitle: 'Pragmatic Mentor • Direct & Sharp',
    description: "Insightful, concise, focused mentor for technical problem solving and coding interviews.",
    icon: Compass,
    color: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
  },
  {
    name: 'Blaze',
    title: 'Blaze',
    subtitle: 'Hype Friend • High Energy & Fun',
    description: "Enthusiastic, witty, motivating partner for brainstorms and celebrating wins.",
    icon: Flame,
    color: 'text-pink-300 bg-pink-500/15 border-pink-500/30',
  },
];

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({
  activePersona,
  onSelectPersona,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const currentOption = PERSONA_OPTIONS.find((p) => p.name === activePersona.name) || PERSONA_OPTIONS[0];
  const IconComponent = currentOption.icon;

  return (
    <div className="relative inline-block text-left z-30">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-3.5 py-1.5 flex items-center gap-2 text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer rounded-full"
      >
        <div className={`p-1 rounded-full border ${currentOption.color}`}>
          <IconComponent size={12} />
        </div>
        <div className="text-left">
          <span className="text-white font-semibold">{activePersona.name}</span>
        </div>
        <ChevronDown size={12} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-72 origin-top-right rounded-2xl bg-[#0d091e] p-2 shadow-2xl z-50 border border-white/[0.12] animate-in fade-in zoom-in-95 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Select AI Persona
            </div>
            <div className="space-y-1">
              {PERSONA_OPTIONS.map((option) => {
                const isSelected = option.name === activePersona.name;
                const OptIcon = option.icon;
                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => {
                      onSelectPersona(option.name);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-2.5 transition-colors ${
                      isSelected ? 'bg-purple-600/30 border border-purple-500/40 text-white' : 'hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg border mt-0.5 ${option.color}`}>
                      <OptIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-white">{option.title}</span>
                        {isSelected && <span className="text-[10px] text-purple-300 font-medium">Active</span>}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">{option.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
