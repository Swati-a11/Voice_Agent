"use client";

import React, { useEffect, useRef } from 'react';
import { ConversationState } from '../types';

interface VisualizerOrbProps {
  state: ConversationState;
  audioLevel?: number; // 0 to 1
  isPlaying?: boolean;
}

export const VisualizerOrb: React.FC<VisualizerOrbProps> = ({ state, audioLevel = 0, isPlaying = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = 380);
    let height = (canvas.height = 380);

    const particles: Array<{
      angle: number;
      radius: number;
      speed: number;
      size: number;
      color: string;
    }> = [];

    // Initialize 60 ambient orbital particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        radius: 80 + Math.random() * 60,
        speed: (Math.random() - 0.5) * 0.02,
        size: 1.5 + Math.random() * 2.5,
        color: '#6366f1'
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      phaseRef.current += 0.03;
      const phase = phaseRef.current;
      const centerX = width / 2;
      const centerY = height / 2;

      // Determine palette based on state
      let primaryColor = 'rgba(99, 102, 241, 0.8)';
      let secondaryColor = 'rgba(236, 72, 153, 0.6)';
      let glowColor = '#6366f1';
      let orbRadius = 75;

      switch (state) {
        case 'LISTENING':
          primaryColor = 'rgba(6, 182, 212, 0.9)';
          secondaryColor = 'rgba(16, 185, 129, 0.7)';
          glowColor = '#06b6d4';
          orbRadius = 75 + Math.sin(phase * 2) * 5;
          break;

        case 'USER_SPEAKING':
          primaryColor = 'rgba(6, 182, 212, 1)';
          secondaryColor = 'rgba(59, 130, 246, 0.9)';
          glowColor = '#38bdf8';
          orbRadius = 80 + audioLevel * 35 + Math.sin(phase * 4) * 8;
          break;

        case 'PROCESSING':
          primaryColor = 'rgba(168, 85, 247, 0.9)';
          secondaryColor = 'rgba(245, 158, 11, 0.7)';
          glowColor = '#a855f7';
          orbRadius = 75 + Math.sin(phase * 5) * 6;
          break;

        case 'AGENT_SPEAKING':
          primaryColor = 'rgba(236, 72, 153, 0.95)';
          secondaryColor = 'rgba(99, 102, 241, 0.85)';
          glowColor = '#ec4899';
          orbRadius = 85 + (isPlaying ? 15 : 5) + Math.sin(phase * 4) * 12;
          break;

        case 'INTERRUPTED':
          primaryColor = 'rgba(239, 68, 68, 1)';
          secondaryColor = 'rgba(245, 158, 11, 0.9)';
          glowColor = '#ef4444';
          orbRadius = 90 + Math.sin(phase * 8) * 10;
          break;

        case 'BACKCHANNEL':
          primaryColor = 'rgba(245, 158, 11, 0.95)';
          secondaryColor = 'rgba(234, 179, 8, 0.8)';
          glowColor = '#f59e0b';
          orbRadius = 80 + Math.sin(phase * 3) * 6;
          break;

        case 'TOOL_CALLING':
          primaryColor = 'rgba(59, 130, 246, 0.95)';
          secondaryColor = 'rgba(14, 165, 233, 0.8)';
          glowColor = '#3b82f6';
          orbRadius = 78 + Math.sin(phase * 6) * 7;
          break;

        case 'IDLE':
        default:
          primaryColor = 'rgba(100, 116, 139, 0.6)';
          secondaryColor = 'rgba(71, 85, 105, 0.4)';
          glowColor = '#64748b';
          orbRadius = 70 + Math.sin(phase) * 3;
          break;
      }

      // Outer Glow
      const glowGrad = ctx.createRadialGradient(centerX, centerY, orbRadius * 0.4, centerX, centerY, orbRadius * 2);
      glowGrad.addColorStop(0, primaryColor);
      glowGrad.addColorStop(0.5, secondaryColor);
      glowGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // Core Orb
      const coreGrad = ctx.createRadialGradient(centerX - 15, centerY - 15, 5, centerX, centerY, orbRadius);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, glowColor);
      coreGrad.addColorStop(0.8, primaryColor);
      coreGrad.addColorStop(1, secondaryColor);

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 30;
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, orbRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Dynamic Frequency Wave Rings
      const ringCount = state === 'AGENT_SPEAKING' || state === 'USER_SPEAKING' ? 4 : 2;
      for (let r = 1; r <= ringCount; r++) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 / r})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const rRad = orbRadius + r * 16 + Math.sin(phase * 3 + r) * 6;
        ctx.arc(centerX, centerY, Math.max(10, rRad), 0, Math.PI * 2);
        ctx.stroke();
      }

      // Orbiting Particles
      particles.forEach((p, idx) => {
        p.angle += p.speed * (state === 'PROCESSING' ? 3 : 1);
        const dynamicRadius = p.radius + Math.sin(phase + idx) * 8 + (state === 'AGENT_SPEAKING' ? audioLevel * 30 : 0);
        const px = centerX + Math.cos(p.angle) * dynamicRadius;
        const py = centerY + Math.sin(p.angle) * dynamicRadius;

        ctx.fillStyle = idx % 2 === 0 ? glowColor : '#ffffff';
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animationIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [state, audioLevel, isPlaying]);

  return (
    <div className="relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={380}
        height={380}
        className="w-[320px] h-[320px] md:w-[380px] md:h-[380px] drop-shadow-2xl pointer-events-none"
      />
    </div>
  );
};
