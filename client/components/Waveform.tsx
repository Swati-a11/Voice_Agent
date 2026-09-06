"use client";

import React, { useEffect, useRef } from 'react';
import { ConversationState } from '../types';

interface WaveformProps {
  analyser: AnalyserNode | null;
  state: ConversationState;
  isActive: boolean;
}

export const Waveform: React.FC<WaveformProps> = ({ analyser, state, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const barCount = 36;
    const dataArray = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let hasLiveAudio = false;
      if (analyser && isActive) {
        try {
          if (analyser.context && analyser.context.state === 'running') {
            analyser.getByteFrequencyData(dataArray);
            hasLiveAudio = true;
          }
        } catch (e) {
          hasLiveAudio = false;
        }
      }

      const barWidth = 3;
      const gap = 4;
      const totalWidth = barCount * (barWidth + gap);
      const startX = (canvas.width - totalWidth) / 2;
      const centerY = canvas.height / 2;

      // Color based on conversation state
      let gradStart = '#6366f1';
      let gradEnd = '#ec4899';
      if (state === 'LISTENING' || state === 'USER_SPEAKING') {
        gradStart = '#06b6d4';
        gradEnd = '#10b981';
      } else if (state === 'INTERRUPTED') {
        gradStart = '#ef4444';
        gradEnd = '#f59e0b';
      } else if (state === 'PROCESSING') {
        gradStart = '#a855f7';
        gradEnd = '#6366f1';
      }

      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, gradStart);
      gradient.addColorStop(1, gradEnd);
      ctx.fillStyle = gradient;

      for (let i = 0; i < barCount; i++) {
        let val = 0;
        if (hasLiveAudio) {
          const dataIdx = Math.floor((i / barCount) * (dataArray.length / 2));
          val = dataArray[dataIdx] / 255;
        } else if (isActive && state === 'AGENT_SPEAKING') {
          val = (Math.sin(Date.now() * 0.008 + i * 0.3) + 1) * 0.4;
        } else if (isActive && state === 'LISTENING') {
          val = (Math.sin(Date.now() * 0.003 + i * 0.2) + 1) * 0.15;
        }

        const barHeight = Math.max(4, val * 36);
        const x = startX + i * (barWidth + gap);
        const y = centerY - barHeight / 2;

        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(x, y, barWidth, barHeight, 2);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, state, isActive]);

  return (
    <div className="flex justify-center items-center w-full my-2">
      <canvas ref={canvasRef} width={280} height={44} className="h-11 w-full max-w-[280px]" />
    </div>
  );
};
