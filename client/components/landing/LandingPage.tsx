"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useVoiceContext } from '../../context/VoiceAgentContext';
import { ThemeToggle } from '../ThemeToggle';
import { Mic, Sparkles, ArrowUpRight, AudioLines, Heart, Stars, ArrowDown, BookOpen } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { state } = useVoiceContext();
  const status = state === 'AGENT_SPEAKING' ? 'Ira is talking' : state === 'LISTENING' || state === 'USER_SPEAKING' ? 'Listening to you' : state === 'PROCESSING' || state === 'TOOL_CALLING' ? 'Thinking it through' : 'Here whenever you need';

  return (
    <div className="ira-home field-journal">
      <div className="home-grain" aria-hidden="true" />
      <header className="home-nav">
        <Link href="/" className="brand-lockup" aria-label="Ira home">
          <span className="brand-icon"><span /></span>
          <span><b>Ira</b><small>COMPANION FIELD NOTES · VOL. 01</small></span>
        </Link>
        <nav className="home-nav-links" aria-label="Main navigation"><a href="#about">The story</a><a href="#magic">The little things</a></nav>
        <div className="home-nav-actions"><ThemeToggle /><Link href="/agent" className="nav-cta">Meet Ira <ArrowUpRight size={15} /></Link></div>
      </header>

      <main>
        <section className="ira-hero" id="about">
          <div className="hero-copy">
            <div className="journal-meta"><span className="journal-rule" /> IRA'S COMPANION JOURNAL <span className="journal-issue">VOL. 01 · HERE WITH YOU</span></div>
            <h1>GOOD TALKS.<br /><em>BIG-HEARTED</em><br />COMPANIONS.</h1>
            <p className="hero-intro">Meet Ira: a warm voice for the big thoughts, the tiny victories, and all the little things in between. Like a good friend, always close by.</p>
            <div className="hero-buttons"><Link href="/agent" className="primary-cta"><Mic size={17} /> Talk with Ira <ArrowUpRight size={16} /></Link><a href="#magic" className="journal-secondary"><BookOpen size={15} /> Read the notes</a></div>
            <div className="hero-footnote"><span className="online-dot" /> <span>{status}</span><span className="footnote-divider" /> <span>Natural conversation, at your pace.</span></div>
          </div>
          <div className="hero-art">
            <div className="journal-orbit orbit-back" /><div className="anime-ray-field" aria-hidden="true" /><div className="journal-cutout" />
            <div className="hero-side-note"><span>IRA'S FRIENDS</span><b>DORAEMON<br />& NOBITA</b><small>ALWAYS IN GOOD COMPANY</small></div>
            <motion.div className="hero-portrait-sheet" animate={{ y: [0, -7, 0], rotate: [-1.2, -.2, -1.2] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <Image src="/ira-nobita-doraemon.png" alt="Doraemon and Nobita, smiling together" width={1024} height={1024} priority className="hero-duo-image" />
              <div className="portrait-caption"><span>IRA'S COMPANION LOG · 001</span><b>A LITTLE WONDER,<br />A LOT OF HEART.</b></div>
            </motion.div>
            <div className="art-sticker sticker-top"><Sparkles size={14} /><span>Always close by</span></div>
            <div className="wanted-note"><span>HERE WHEN YOU NEED HER</span><span className="wanted-mark" /></div>
          </div>
          <a href="#magic" className="turn-page"><span>TURN THE PAGE</span><ArrowDown size={14} /></a>
        </section>

        <section className="magic-strip" id="magic">
          <div className="magic-intro"><span className="section-kicker"><Stars size={13} /> THE IRA NOTES · 01—03</span><h2>A GOOD TALK<br /><em>CHANGES THE DAY.</em></h2><p>Thoughtful company for whatever the day brings.</p></div>
          <div className="magic-card"><span className="magic-icon blue"><AudioLines size={19} /></span><span className="card-number">01 / LISTEN</span><h3>A conversation that flows</h3><p>Talk naturally, change your mind mid-sentence, and pick up right where you left off.</p><span className="card-foot">REAL TIME · YOUR PACE</span></div>
          <div className="magic-card"><span className="magic-icon coral"><Heart size={18} /></span><span className="card-number">02 / REMEMBER</span><h3>She knows your world</h3><p>Your stories and preferences stay close, so you don't have to start from the beginning.</p><span className="card-foot">CONTEXT THAT STAYS</span></div>
          <div className="magic-card"><span className="magic-icon gold"><Sparkles size={18} /></span><span className="card-number">03 / BE HERE</span><h3>For every kind of day</h3><p>From a quick question to a long late-night thought, Ira meets you where you are.</p><span className="card-foot">A FRIENDLY VOICE</span></div>
        </section>
      </main>

      <footer className="home-footer"><Link href="/" className="footer-brand"><span className="brand-icon small"><span /></span> Ira</Link><span>A softer place to land, one conversation at a time.</span><Link href="/agent" className="footer-link">Say hello <ArrowUpRight size={13} /></Link></footer>
    </div>
  );
};
