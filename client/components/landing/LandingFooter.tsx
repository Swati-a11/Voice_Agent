"use client";

import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Mic, Terminal, Activity, Database } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="relative border-t border-white/[0.08] bg-[#05030a] pt-16 pb-12 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto flex flex-col items-center">
        {/* Bottom CTA Banner */}
        <div className="w-full glass-card border-purple-500/30 p-8 sm:p-12 mb-16 rounded-3xl text-center relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 max-w-xl mx-auto">
            <h3 className="font-display font-medium text-2xl sm:text-3xl text-white mb-3 tracking-tight">
              Ready to talk with Ayra?
            </h3>
            <p className="text-sm text-white/60 mb-6 leading-relaxed">
              Experience truly human-like voice conversations with sub-400ms latency, Hinglish code-switching, and instant interruptions.
            </p>
            <Link
              href="/agent"
              className="btn-hero-cta min-w-[200px] h-[52px]"
            >
              <Mic size={17} className="text-purple-600" />
              <span>Start Voice Session</span>
              <ArrowRight size={16} className="text-black/70" />
            </Link>
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <span className="font-display font-semibold text-white tracking-tight">
              Ayra Voice AI
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-white/50">
            <Link href="/agent" className="hover:text-purple-300 transition-colors flex items-center gap-1.5">
              <Mic size={13} />
              <span>Voice Agent</span>
            </Link>
            <Link href="/scenarios" className="hover:text-purple-300 transition-colors flex items-center gap-1.5">
              <Terminal size={13} />
              <span>Scenarios</span>
            </Link>
            <Link href="/metrics" className="hover:text-purple-300 transition-colors flex items-center gap-1.5">
              <Activity size={13} />
              <span>Latency Metrics</span>
            </Link>
            <Link href="/settings" className="hover:text-purple-300 transition-colors flex items-center gap-1.5">
              <Database size={13} />
              <span>Persona & Memory</span>
            </Link>
          </div>
        </div>

        {/* Copyright & Disclaimer */}
        <div className="w-full pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <p>© {new Date().getFullYear()} Ayra AI. Natural conversational companion.</p>
          <p className="text-[11px] text-white/30">
            Personal AI assistant inspired by Swati’s communication style • ₹0 Local TTS Architecture
          </p>
        </div>
      </div>
    </footer>
  );
};
