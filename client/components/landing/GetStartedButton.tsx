"use client";

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export const GetStartedButton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
      className="w-full flex justify-center px-5 sm:px-0"
    >
      <Link
        href="/agent"
        aria-label="Get Started"
        className="btn-get-started w-full sm:w-[220px] h-[56px] text-base"
      >
        <span>Get Started</span>
      </Link>
    </motion.div>
  );
};
