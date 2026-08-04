import React, { useEffect, useRef } from 'react';
import { useAudio } from '../context/AudioContext';

export default function AudioVisualizerCanvas({ height = 48, barCount = 24, className = "" }) {
  const canvasRef = useRef(null);
  const { isPlaying } = useAudio();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = () => {
      const w = canvas.width = canvas.parentElement?.clientWidth || 200;
      const h = canvas.height = height;
      ctx.clearRect(0, 0, w, h);

      const bufferLength = barCount;
      const time = Date.now() * 0.006;
      const barWidth = Math.max((w / bufferLength) - 3, 2);
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // High-definition multi-frequency wave calculation
        let val;
        if (isPlaying) {
          const freq1 = Math.sin(time * 2 + i * 0.35);
          const freq2 = Math.cos(time * 3 + i * 0.2);
          const freq3 = Math.sin(time * 1.5 + i * 0.5);
          val = Math.abs((freq1 + freq2 + freq3) / 3) * 220 + 35;
        } else {
          val = Math.abs(Math.sin(time * 0.4 + i * 0.2)) * 25 + 8;
        }

        const barHeight = Math.min((val / 255) * h * 0.85 + 4, h);

        // Vibrant cartoon gradient fill
        const gradient = ctx.createLinearGradient(0, h, 0, 0);
        gradient.addColorStop(0, '#FFD166');
        gradient.addColorStop(0.5, '#FF477E');
        gradient.addColorStop(1, '#38BDF8');

        ctx.fillStyle = gradient;
        ctx.strokeStyle = '#18181B';
        ctx.lineWidth = 1.5;

        // Rounded top bars
        const radius = Math.min(barWidth / 2, 4);
        const y = h - barHeight;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
        ctx.stroke();

        x += barWidth + 3;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, height, barCount]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full block select-none pointer-events-none ${className}`}
      style={{ height: `${height}px` }}
    />
  );
}

