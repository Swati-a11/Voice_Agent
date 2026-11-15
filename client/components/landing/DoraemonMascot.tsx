"use client";

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { ConversationState } from '../../types';

export function DoraemonMascot({ state }: { state: ConversationState }) {
  const active = state === 'AGENT_SPEAKING' || state === 'LISTENING' || state === 'USER_SPEAKING';
  return (
    <motion.div className={`ira-mascot ${active ? 'ira-mascot-active' : ''}`} animate={{ y: [0, -9, 0], rotate: [0, 1.2, 0, -1.2, 0] }} transition={{ duration: state === 'AGENT_SPEAKING' ? 1.7 : 4.4, repeat: Infinity, ease: 'easeInOut' }} aria-label="Ira, your friendly voice companion" role="img">
      <div className="mascot-shadow" />
      <svg className="mascot-svg" viewBox="0 0 300 310" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="catBlue" x1="58" y1="38" x2="223" y2="246" gradientUnits="userSpaceOnUse"><stop stopColor="#80D9FF"/><stop offset=".52" stopColor="#29A9E8"/><stop offset="1" stopColor="#1683CF"/></linearGradient>
          <linearGradient id="faceWhite" x1="100" y1="84" x2="206" y2="178" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset="1" stopColor="#E8F8FF"/></linearGradient>
          <linearGradient id="belly" x1="102" y1="190" x2="199" y2="276" gradientUnits="userSpaceOnUse"><stop stopColor="#fff"/><stop offset="1" stopColor="#DDF4FF"/></linearGradient>
        </defs>
        <ellipse cx="150" cy="275" rx="91" ry="19" fill="#0E74AC" opacity=".16"/>
        {/* soft ears and round head */}
        <ellipse cx="70" cy="88" rx="19" ry="25" fill="url(#catBlue)" stroke="#147CB8" strokeWidth="4"/>
        <ellipse cx="230" cy="88" rx="19" ry="25" fill="url(#catBlue)" stroke="#147CB8" strokeWidth="4"/>
        <ellipse cx="150" cy="105" rx="88" ry="80" fill="url(#catBlue)" stroke="#147CB8" strokeWidth="5"/>
        <ellipse cx="150" cy="126" rx="67" ry="57" fill="url(#faceWhite)" stroke="#C5EEFF" strokeWidth="2"/>
        {/* eyes */}
        <ellipse cx="132" cy="79" rx="12" ry="17" fill="white" stroke="#17425C" strokeWidth="3"/><ellipse cx="168" cy="79" rx="12" ry="17" fill="white" stroke="#17425C" strokeWidth="3"/>
        <ellipse cx="135" cy="84" rx="4.6" ry="7" fill="#17394A"/><ellipse cx="165" cy="84" rx="4.6" ry="7" fill="#17394A"/>
        <circle cx="136.5" cy="81" r="1.6" fill="white"/><circle cx="166.5" cy="81" r="1.6" fill="white"/>
        <circle cx="150" cy="112" r="9" fill="#EF5B67" stroke="#D74651" strokeWidth="2"/>
        <path d="M150 122v20c0 12-9 19-21 19" stroke="#43596A" strokeWidth="3" strokeLinecap="round"/>
        <path d="M94 116h37M93 132l39 4M206 116h-37M207 132l-39 4" stroke="#60798A" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M76 167c-4 21-19 32-31 35 10 12 26 10 42 1 12 12 34 19 63 19s51-7 63-19c16 9 32 11 42-1-12-3-27-14-31-35" fill="url(#catBlue)" stroke="#147CB8" strokeWidth="4" strokeLinejoin="round"/>
        <path d="M95 194c13-11 30-17 55-17s42 6 55 17l13 56c-17 15-41 23-68 23s-51-8-68-23l13-56Z" fill="url(#belly)" stroke="#B7E6FA" strokeWidth="3"/>
        <path d="M104 205c12-9 28-13 46-13s34 4 46 13v17c-11 9-27 14-46 14s-35-5-46-14v-17Z" fill="white" stroke="#C5EAF7" strokeWidth="2"/>
        <path d="M115 222c8 4 20 6 35 6s27-2 35-6" stroke="#D5EDF7" strokeWidth="2"/>
        {/* collar and bell */}
        <path d="M84 178c18 13 40 20 66 20s48-7 66-20l6 12c-20 17-44 25-72 25s-52-8-72-25l6-12Z" fill="#EF5964" stroke="#D8434D" strokeWidth="3"/>
        <circle cx="150" cy="208" r="15" fill="#F6C84A" stroke="#D39A22" strokeWidth="3"/><path d="M142 204h16M150 208v9" stroke="#A86E16" strokeWidth="2" strokeLinecap="round"/>
        {/* arms and feet */}
        <ellipse cx="72" cy="207" rx="20" ry="13" transform="rotate(-27 72 207)" fill="url(#catBlue)" stroke="#147CB8" strokeWidth="3"/><ellipse cx="228" cy="207" rx="20" ry="13" transform="rotate(27 228 207)" fill="url(#catBlue)" stroke="#147CB8" strokeWidth="3"/>
        <ellipse cx="112" cy="266" rx="34" ry="14" fill="white" stroke="#B9E5F6" strokeWidth="3"/><ellipse cx="188" cy="266" rx="34" ry="14" fill="white" stroke="#B9E5F6" strokeWidth="3"/>
        <path d="M102 245v13M198 245v13" stroke="#147CB8" strokeWidth="5" strokeLinecap="round"/>
        <path d="M113 58c11-11 26-17 43-18" stroke="white" strokeOpacity=".62" strokeWidth="5" strokeLinecap="round"/>
      </svg>
      <Sparkles className="mascot-sparkle sparkle-one" size={22} /><Sparkles className="mascot-sparkle sparkle-two" size={18} />
    </motion.div>
  );
}
