import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  size: number;
  speed: number;
  alpha: number;
};

type ParticleFieldProps = {
  className?: string;
};

const PARTICLE_COUNT = 180;

/**
 * Subtle white particles that drift slowly inward toward the centre.
 * They reset from the edges when they get close enough to centre,
 * creating a continuous soft inward-flow effect matching the screenshot.
 */
export function ParticleField({ className }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    const particles: Particle[] = [];

    const spawnEdge = (): Particle => {
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = Math.random() * W; y = -8; }
      else if (edge === 1) { x = W + 8; y = Math.random() * H; }
      else if (edge === 2) { x = Math.random() * W; y = H + 8; }
      else { x = -8; y = Math.random() * H; }
      return {
        x,
        y,
        size: Math.random() > 0.8 ? 1.5 : 1,
        speed: 0.12 + Math.random() * 0.28,
        alpha: 0.12 + Math.random() * 0.30,
      };
    };

    const spawnRandom = (): Particle => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() > 0.8 ? 1.5 : 1,
      speed: 0.12 + Math.random() * 0.28,
      alpha: 0.12 + Math.random() * 0.30,
    });

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const bounds = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      W = Math.floor(bounds.width);
      H = Math.floor(bounds.height);
      cx = W * 0.5;
      cy = H * 0.5;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (particles.length === 0) {
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          particles.push(spawnRandom());
        }
      }
    };

    const render = () => {
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.hypot(dx, dy) || 1;

        // Gentle inward drift
        const pull = p.speed * (0.5 + (1 - Math.min(dist / (Math.max(W, H) * 0.5), 1)) * 0.8);
        p.x += (dx / dist) * pull;
        p.y += (dy / dist) * pull;

        // Fade near centre
        const fadeFactor = Math.min(dist / (Math.max(W, H) * 0.38), 1);
        ctx.globalAlpha = p.alpha * Math.max(fadeFactor, 0.05);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Reset when within 30px of centre
        if (dist < 30) {
          const np = spawnEdge();
          p.x = np.x;
          p.y = np.y;
          p.size = np.size;
          p.speed = np.speed;
          p.alpha = np.alpha;
        }
      }

      raf = requestAnimationFrame(render);
    };

    resize();
    render();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
