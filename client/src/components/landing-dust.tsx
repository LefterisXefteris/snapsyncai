import { useEffect, useRef } from "react";

type Speck = {
  x: number;
  y: number;
  r: number;
  a: number;
  vx: number;
  vy: number;
};

function speckCount(width: number, height: number) {
  const area = width * height;
  return Math.min(64, Math.max(22, Math.round(area / 24000)));
}

export function LandingDust() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const specks: Speck[] = [];
    let raf = 0;
    let running = true;

    const layout = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      specks.length = 0;
      const count = speckCount(width, height);
      for (let i = 0; i < count; i++) {
        specks.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.4 + Math.random() * 1.3,
          a: 0.12 + Math.random() * 0.38,
          vx: (Math.random() - 0.5) * 0.16,
          vy: -(0.04 + Math.random() * 0.1),
        });
      }
      return true;
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);
      for (const speck of specks) {
        if (!reduced) {
          speck.x += speck.vx;
          speck.y += speck.vy;
          if (speck.y < -6) speck.y = height + 6;
          if (speck.x < -6) speck.x = width + 6;
          if (speck.x > width + 6) speck.x = -6;
        }
        ctx.beginPath();
        ctx.fillStyle = `hsla(43, 74%, 52%, ${speck.a})`;
        ctx.arc(speck.x, speck.y, speck.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = () => {
      if (!running || document.hidden) return;
      draw();
      if (!reduced) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };

    layout();
    start();

    const onResize = () => {
      if (!layout()) return;
      if (reduced) draw();
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", start);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", start);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
