"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href?: string };

export function TalkTransitionLink({ children, onClick, href = '/agent', ...props }: Props) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [opening, setOpening] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (opening) return;
    if (reducedMotion) {
      router.push(href);
      return;
    }
    setOpening(true);
    timer.current = setTimeout(() => router.push(href), 560);
  };

  return <>
    <Link href={href} {...props} onClick={handleClick}>{children}</Link>
    <AnimatePresence>
      {opening && <motion.div className="talk-page-transition" aria-hidden="true" initial={{ clipPath: 'circle(0% at 50% 55%)' }} animate={{ clipPath: 'circle(150% at 50% 55%)' }} exit={{ opacity: 0 }} transition={{ duration: .52, ease: [0.76, 0, 0.24, 1] }}>
        <motion.span initial={{ y: 24, opacity: 0, rotate: -5 }} animate={{ y: 0, opacity: 1, rotate: -5 }} transition={{ delay: .12, duration: .28 }}>
          LET’S TALK
        </motion.span>
        <i /><i /><i />
      </motion.div>}
    </AnimatePresence>
  </>;
}
