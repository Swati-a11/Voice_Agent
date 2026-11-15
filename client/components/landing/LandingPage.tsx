"use client";

import React from 'react';
import Link from 'next/link';
import { useVoiceContext } from '../../context/VoiceAgentContext';
import { ThemeToggle } from '../ThemeToggle';
import { DoraemonMascot } from './DoraemonMascot';
import { Mic, Sparkles, ArrowUpRight, AudioLines, Heart, Stars } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { state } = useVoiceContext();
  const status = state === 'AGENT_SPEAKING' ? 'Ira is talking' : state === 'LISTENING' || state === 'USER_SPEAKING' ? 'Listening to you' : state === 'PROCESSING' || state === 'TOOL_CALLING' ? 'Thinking it through' : 'Here whenever you need';

  return (
    <div className="ira-home">
      <div className="home-grain" aria-hidden="true" />
      <header className="home-nav">
        <Link href="/" className="brand-lockup" aria-label="Ira home">
          <span className="brand-icon"><span /></span>
          <span><b>Ira</b><small>YOUR VOICE COMPANION</small></span>
        </Link>
        <nav className="home-nav-links" aria-label="Main navigation"><a href="#about">The feeling</a><a href="#magic">Little details</a></nav>
        <div className="home-nav-actions"><ThemeToggle /><Link href="/agent" className="nav-cta">Talk to Ira <ArrowUpRight size={15} /></Link></div>
      </header>

      <main>
        <section className="ira-hero" id="about">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> A little magic, whenever you need it</div>
            <h1>Your day feels<br /><em>lighter</em> with Ira.</h1>
            <p className="hero-intro">A warm voice, a curious mind, and a tiny bit of wonder. Ira is here for the big thoughts, the small moments, and everything in between.</p>
            <div className="hero-buttons"><Link href="/agent" className="primary-cta"><Mic size={17} /> Start a conversation <ArrowUpRight size={16} /></Link><span className="quiet-note"><span className="online-dot" /> {status}</span></div>
            <div className="hero-footnote"><span className="footnote-icon"><Heart size={14} fill="currentColor" /></span><span>Made for the moments you want someone to talk to.</span></div>
          </div>
          <div className="hero-art">
            <div className="art-halo halo-back" /><div className="art-halo halo-front" />
            <div className="orbit orbit-a"><i /><i /><i /></div><div className="orbit orbit-b"><i /><i /></div>
            <div className="art-sticker sticker-top"><Sparkles size={14} /><span>Always listening</span></div>
            <DoraemonMascot state={state} />
            <div className="art-sticker sticker-bottom"><Heart size={14} className="sticker-heart" fill="currentColor" /><span>your pocket-sized pal</span></div>
            <Sparkles className="art-star star-left" size={20} /><Sparkles className="art-star star-right" size={17} />
          </div>
        </section>

        <section className="magic-strip" id="magic">
          <div className="magic-intro"><span className="section-kicker"><Stars size={13} /> THE IRA WAY</span><h2>Small moments.<br /><em>Big comfort.</em></h2></div>
          <div className="magic-card"><span className="magic-icon blue"><AudioLines size={19} /></span><h3>Feels like a real chat</h3><p>Speak naturally, interrupt anytime, and pick up right where you left off.</p><span className="card-number">01</span></div>
          <div className="magic-card"><span className="magic-icon coral"><Heart size={18} /></span><h3>Remembers your world</h3><p>Your stories and preferences stay close, so Ira gets to know you over time.</p><span className="card-number">02</span></div>
          <div className="magic-card"><span className="magic-icon gold"><Sparkles size={18} /></span><h3>Here for every mood</h3><p>From a quick question to a long late-night talk, Ira meets you where you are.</p><span className="card-number">03</span></div>
        </section>
      </main>

      <footer className="home-footer"><Link href="/" className="footer-brand"><span className="brand-icon small"><span /></span> Ira</Link><span>A softer place to land, one conversation at a time.</span><Link href="/agent" className="footer-link">Say hello <ArrowUpRight size={13} /></Link></footer>
    </div>
  );
};
