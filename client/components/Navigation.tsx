"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Mic, Activity, Database, PlayCircle } from 'lucide-react';
import { useVoiceContext } from '../context/VoiceAgentContext';
import { PersonaSwitcher } from './PersonaSwitcher';

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { state, activePersona, switchPersona } = useVoiceContext();

  const navItems = [
    { href: '/agent', label: 'Voice Call', icon: Mic },
    { href: '/scenarios', label: 'Scenarios', icon: PlayCircle },
    { href: '/metrics', label: 'Performance', icon: Activity },
    { href: '/settings', label: 'Memory & Persona', icon: Database },
  ];

  const getStateLabel = () => {
    switch (state) {
      case 'LISTENING':
      case 'USER_SPEAKING':
        return { text: 'Listening', class: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
      case 'PROCESSING':
      case 'TOOL_CALLING':
        return { text: 'Thinking', class: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
      case 'AGENT_SPEAKING':
        return { text: 'Speaking', class: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
      case 'INTERRUPTED':
        return { text: 'Barge-In', class: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
      case 'IDLE':
      default:
        return { text: 'Standby', class: 'bg-white/5 text-slate-400 border-white/10' };
    }
  };

  const status = getStateLabel();

  return (
    <header className="sticky top-0 z-40 w-full bg-[#05030A]/80 backdrop-blur-xl border-b border-white/[0.08] px-4 lg:px-8 py-3 mb-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5 text-white font-display text-base font-semibold group">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-md shadow-purple-500/25 group-hover:scale-105 transition-transform">
            <Sparkles size={16} className="text-white" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="tracking-tight text-white font-semibold">Ayra</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 font-medium">
              AI Voice
            </span>
          </div>
        </Link>

        {/* Clean Pill Navigation Tabs */}
        <nav className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/agent' && pathname === '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]'
                }`}
              >
                <Icon size={13} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side: Live Status & Persona */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${status.class}`}>
              ● {status.text}
            </span>
          </div>

          <PersonaSwitcher
            activePersona={activePersona}
            onSelectPersona={switchPersona}
            disabled={state === 'AGENT_SPEAKING'}
          />
        </div>
      </div>
    </header>
  );
};
