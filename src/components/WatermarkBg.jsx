import React, { useEffect, useRef } from 'react';

export default function WatermarkBg() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let resizeTimer = null;

    // DPI-aware sizing for crisp rendering on all devices
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    let cssWidth = window.innerWidth;
    let cssHeight = window.innerHeight;

    const setupCanvas = () => {
      cssWidth = window.innerWidth;
      cssHeight = window.innerHeight;
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    setupCanvas();

    // Debounced resize to prevent thrashing on orientation change
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setupCanvas();
        // Re-seed particles for new dimensions
        initParticles();
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    // Mouse / Touch Position
    const mouse = { x: -1000, y: -1000, radius: 140 };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleTouchMove = (e) => {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouchMove, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });

    // Define 2D Doodle Types & Candy Pastel Colors
    const DOODLE_TYPES = ['star', 'rocket', 'note', 'cloud', 'planet', 'cat', 'heart', 'ring', 'bubble'];
    const COLORS = ['#FF9EAA', '#FFD166', '#48CAE4', '#C084FC', '#34D399', '#FF6B8B'];

    // Adaptive particle count: fewer on mobile for performance, more on desktop
    const isMobile = cssWidth < 768;
    const maxParticles = isMobile ? 8 : 16;
    let particles = [];

    const initParticles = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = Math.min(Math.floor((w * h) / (isMobile ? 60000 : 35000)), maxParticles);
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          baseX: Math.random() * w,
          baseY: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          size: Math.random() * 18 + 18,
          type: DOODLE_TYPES[Math.floor(Math.random() * DOODLE_TYPES.length)],
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          angle: Math.random() * Math.PI * 2,
          angularVelocity: (Math.random() - 0.5) * 0.02,
          phase: Math.random() * Math.PI * 2
        });
      }
    };
    initParticles();

    let time = 0;

    // Draw Vector Path for Doodles
    const drawDoodle = (p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = 0.18;

      const r = p.size;

      switch (p.type) {
        case 'star':
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * r, -Math.sin((18 + i * 72) * Math.PI / 180) * r);
            ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (r * 0.5), -Math.sin((54 + i * 72) * Math.PI / 180) * (r * 0.5));
          }
          ctx.closePath();
          ctx.stroke();
          break;

        case 'note':
          ctx.beginPath();
          ctx.arc(-r * 0.3, r * 0.3, r * 0.3, 0, Math.PI * 2);
          ctx.moveTo(-r * 0.0, r * 0.3);
          ctx.lineTo(-r * 0.0, -r * 0.4);
          ctx.lineTo(r * 0.4, -r * 0.6);
          ctx.lineTo(r * 0.4, r * 0.1);
          ctx.arc(r * 0.1, r * 0.1, r * 0.3, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'cloud':
          ctx.beginPath();
          ctx.arc(-r * 0.3, 0, r * 0.4, Math.PI * 0.5, Math.PI * 1.5);
          ctx.arc(0, -r * 0.3, r * 0.5, Math.PI, Math.PI * 2);
          ctx.arc(r * 0.3, 0, r * 0.4, Math.PI * 1.5, Math.PI * 0.5);
          ctx.closePath();
          ctx.stroke();
          break;

        case 'planet':
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
          ctx.ellipse(0, 0, r * 0.9, r * 0.25, -Math.PI / 6, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'rocket':
          ctx.beginPath();
          ctx.moveTo(0, -r * 0.6);
          ctx.quadraticCurveTo(r * 0.5, 0, 0, r * 0.6);
          ctx.quadraticCurveTo(-r * 0.5, 0, 0, -r * 0.6);
          ctx.moveTo(-r * 0.3, r * 0.2);
          ctx.lineTo(-r * 0.6, r * 0.6);
          ctx.moveTo(r * 0.3, r * 0.2);
          ctx.lineTo(r * 0.6, r * 0.6);
          ctx.stroke();
          break;

        case 'cat':
          ctx.beginPath();
          ctx.arc(0, r * 0.1, r * 0.5, 0, Math.PI * 2);
          ctx.moveTo(-r * 0.4, -r * 0.2);
          ctx.lineTo(-r * 0.4, -r * 0.6);
          ctx.lineTo(-r * 0.1, -r * 0.4);
          ctx.moveTo(r * 0.4, -r * 0.2);
          ctx.lineTo(r * 0.4, -r * 0.6);
          ctx.lineTo(r * 0.1, -r * 0.4);
          ctx.stroke();
          break;

        case 'heart':
          ctx.beginPath();
          ctx.moveTo(0, r * 0.4);
          ctx.bezierCurveTo(-r * 0.6, 0, -r * 0.6, -r * 0.5, 0, -r * 0.3);
          ctx.bezierCurveTo(r * 0.6, -r * 0.5, r * 0.6, 0, 0, r * 0.4);
          ctx.stroke();
          break;

        default: // Ring
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
          ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
          ctx.stroke();
          break;
      }

      ctx.restore();
    };

    // Render loop
    const render = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);
      time += 0.015;

      particles.forEach((p) => {
        // Sinusoidal floating drift
        p.x += p.vx + Math.sin(time + p.phase) * 0.25;
        p.y += p.vy + Math.cos(time + p.phase) * 0.25;
        p.angle += p.angularVelocity;

        // Wrap around screen boundaries
        if (p.x < -40) p.x = w + 40;
        if (p.x > w + 40) p.x = -40;
        if (p.y < -40) p.y = h + 40;
        if (p.y > h + 40) p.y = -40;

        // Mouse Disperse Physics Push
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          const angle = Math.atan2(dy, dx);
          p.x += Math.cos(angle) * force * 10;
          p.y += Math.sin(angle) * force * 10;
        }

        drawDoodle(p);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Pause animation when tab is hidden to save battery
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        render();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchMove);
      window.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 select-none transition-opacity duration-300"
    />
  );
}
